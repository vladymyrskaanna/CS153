"""LLM wrapper. Supports two backends:

1. **Anthropic** (anthropic SDK) — used when ANTHROPIC_API_KEY or
   CLAUDE_CODE_OAUTH_TOKEN is set. Has native server-side web_search / web_fetch
   tools.

2. **Gradient** (DigitalOcean GenAI Platform, OpenAI-compatible) — used when
   MODEL_ACCESS_KEY is set. Tool use happens client-side via aimerch.web_tools.

Backend is auto-detected at import; can be overridden with LLM_BACKEND=gradient|anthropic.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

import anthropic

try:
    from gradient import Gradient
    HAS_GRADIENT = True
except ImportError:
    HAS_GRADIENT = False

from .config import (
    MODEL_EXTRACT,
    MODEL_RESEARCH,
    MODEL_SYNTHESIZE,
    anthropic_auth,
)

log = logging.getLogger(__name__)


# Thread-local accumulator that the orchestrator can reset/read between phases.
import threading
_usage_local = threading.local()


def reset_usage_accumulator() -> None:
    _usage_local.totals = {
        "input_tokens": 0, "output_tokens": 0,
        "cache_read_tokens": 0, "cache_write_tokens": 0,
        "web_searches": 0, "web_search_cost_usd": 0.0,
        "llm_cost_usd": 0.0,
    }


def get_usage_accumulator() -> dict:
    if not hasattr(_usage_local, "totals"):
        reset_usage_accumulator()
    return dict(_usage_local.totals)


def _add_to_accumulator(usage: dict) -> None:
    if not hasattr(_usage_local, "totals"):
        reset_usage_accumulator()
    for k, v in usage.items():
        _usage_local.totals[k] = _usage_local.totals.get(k, 0) + v


def _count_tavily_searches(text: str) -> int:
    """Heuristic: count how many web_search tool invocations are referenced
    in the agent's reply (or its tool-output blocks). DO Agent doesn't expose
    a clean counter, so we approximate via URL count."""
    if not text:
        return 0
    import re as _re
    # Count distinct https URLs present (approx 1 per search result × ~5 results = ~5 per search)
    urls = set(_re.findall(r"https?://[^\s\)\]\"']+", text))
    return max(1, len(urls) // 5) if urls else 0


# ─── Backend detection ────────────────────────────────────────────────────

def _backend() -> str:
    forced = os.environ.get("LLM_BACKEND", "").strip().lower()
    if forced in ("gradient", "anthropic"):
        return forced
    if HAS_GRADIENT and os.environ.get("MODEL_ACCESS_KEY", "").strip():
        return "gradient"
    return "anthropic"


# Map our canonical model IDs → Gradient's naming convention.
_GRADIENT_MODEL_MAP = {
    "claude-opus-4-7":         "anthropic-claude-opus-4.7",
    "claude-opus-4-6":         "anthropic-claude-opus-4.6",
    "claude-opus-4-5":         "anthropic-claude-opus-4.5",
    "claude-sonnet-4-6":       "anthropic-claude-4.6-sonnet",
    "claude-sonnet-4-5":       "anthropic-claude-4.5-sonnet",
    "claude-haiku-4-5-20251001": "anthropic-claude-haiku-4.5",
    "claude-haiku-4-5":        "anthropic-claude-haiku-4.5",
}


def _gradient_model(model: str) -> str:
    return _GRADIENT_MODEL_MAP.get(model, model)


def _sleep_with_jitter(base: float, attempt: int) -> None:
    delay = base * (2 ** attempt)
    log.info("rate_limit_retry sleeping %.1fs (attempt %d)", delay, attempt + 1)
    time.sleep(delay)


def _create_with_retry(client: anthropic.Anthropic, **kwargs) -> anthropic.types.Message:
    """messages.create with exponential backoff on rate limit / overload."""
    last_exc: Exception | None = None
    for attempt in range(6):
        try:
            return client.messages.create(**kwargs)
        except (anthropic.RateLimitError, anthropic.APIStatusError, anthropic.APIConnectionError) as e:
            last_exc = e
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (429, 500, 502, 503, 529) or isinstance(e, anthropic.RateLimitError):
                _sleep_with_jitter(8.0, attempt)
                continue
            raise
    assert last_exc is not None
    raise last_exc


# Pricing per 1M tokens (approximate, for cost telemetry only).
# Format: (input, cache_write, cache_read, output)
_PRICING = {
    # Format: (input, cache_write, cache_read, output) per 1M tokens.
    # Source: DigitalOcean Gradient API model list. Opus 4.7 is significantly
    # cheaper than 4.0/4.1 — DO's pricing differs from Anthropic-direct.
    "claude-opus-4-7":        (5.0,   6.25,  0.50, 25.0),
    "claude-opus-4-7-1m":     (5.0,   6.25,  0.50, 25.0),
    "claude-opus-4-6":        (30.0, 37.50,  3.00, 150.0),
    "claude-opus-4-5":        (5.0,   6.25,  0.50, 25.0),
    "claude-opus-4-1":        (15.0, 18.75,  1.50, 75.0),
    "claude-opus-4":          (15.0, 18.75,  1.50, 75.0),
    "claude-sonnet-4-6":      (3.0,   3.75,  0.30, 15.0),
    "claude-sonnet-4-5":      (3.0,   3.75,  0.30, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 1.25,  0.10, 5.0),
    "claude-haiku-4-5":       (1.0,   1.25,  0.10, 5.0),
}


# Opus 4.7 supports a 1M-context beta. Set the header on requests using opus.
OPUS_1M_BETA = "context-1m-2025-08-07"


def _extra_headers_for(model: str) -> dict | None:
    if model.startswith("claude-opus-4-7"):
        return {"anthropic-beta": OPUS_1M_BETA}
    return None


def _supports_temperature(model: str) -> bool:
    """Opus 4.7 deprecated the temperature param; only newer reasoning controls supported."""
    return not model.startswith("claude-opus-4-7")


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(**anthropic_auth())


def _gradient_client() -> "Gradient":
    """Return a Gradient client.

    Preferred: DO_AGENT_ENDPOINT + DO_AGENT_KEY (the agent-specific access token
    from DO console). Routes through the agent endpoint, where the agent's
    enabled tools (web_search etc.) are auto-applied server-side.

    Fallback: MODEL_ACCESS_KEY (bare inference, no built-in tools).
    """
    if not HAS_GRADIENT:
        raise RuntimeError("gradient SDK not installed. pip install gradient")

    agent_endpoint = os.environ.get("DO_AGENT_ENDPOINT", "").strip().rstrip("/")
    agent_key = os.environ.get("DO_AGENT_KEY", "").strip()
    timeout = float(os.environ.get("LLM_TIMEOUT_SEC", "600"))
    max_retries = int(os.environ.get("LLM_MAX_RETRIES", "2"))
    if agent_endpoint and agent_key:
        # SDK trick: pass agent key as model_access_key + agent URL as base_url.
        return Gradient(
            model_access_key=agent_key,
            base_url=agent_endpoint + "/api/v1",
            timeout=timeout,
            max_retries=max_retries,
        )

    key = os.environ.get("MODEL_ACCESS_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "Set either DO_AGENT_ENDPOINT+DO_AGENT_KEY (preferred, has web_search) "
            "or MODEL_ACCESS_KEY (bare inference, no tools)"
        )
    return Gradient(model_access_key=key, timeout=timeout, max_retries=max_retries)


def _is_agent_endpoint() -> bool:
    """True if we're using the DO Agent endpoint (web_search auto-fires)."""
    return bool(
        os.environ.get("DO_AGENT_ENDPOINT", "").strip()
        and os.environ.get("DO_AGENT_KEY", "").strip()
    )


def estimate_cost(model: str, usage: Any) -> float:
    p = _PRICING.get(model)
    if not p:
        return 0.0
    inp = getattr(usage, "input_tokens", 0) or 0
    cw = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cr = getattr(usage, "cache_read_input_tokens", 0) or 0
    out = getattr(usage, "output_tokens", 0) or 0
    return (inp * p[0] + cw * p[1] + cr * p[2] + out * p[3]) / 1_000_000


def chat(
    *,
    model: str,
    system: str | list[dict],
    messages: list[dict],
    max_tokens: int = 8000,
    tools: Optional[list[dict]] = None,
    temperature: float = 0.5,
) -> tuple[str, list[dict], float]:
    """Single-shot chat with prompt caching on system prompt.

    Returns (text_output, full_content_blocks, estimated_cost_usd).
    """
    if _backend() == "gradient":
        return _gradient_chat(
            model=model, system=system, messages=messages,
            max_tokens=max_tokens, tools=tools, temperature=temperature,
        )

    client = _client()

    if isinstance(system, str):
        system_blocks = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
    else:
        system_blocks = system

    kwargs: dict[str, Any] = dict(
        model=model,
        system=system_blocks,
        max_tokens=max_tokens,
        messages=messages,
    )
    if _supports_temperature(model):
        kwargs["temperature"] = temperature
    if tools:
        kwargs["tools"] = tools
    extra = _extra_headers_for(model)
    if extra:
        kwargs["extra_headers"] = extra

    resp = _create_with_retry(client, **kwargs)

    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    cost = estimate_cost(model, resp.usage)
    return text, [b.model_dump() for b in resp.content], cost


def _gradient_chat(
    *, model: str, system: str | list[dict], messages: list[dict],
    max_tokens: int, tools: Optional[list[dict]] = None, temperature: float,
) -> tuple[str, list[dict], float]:
    """Gradient (DigitalOcean GenAI) — OpenAI-compatible.

    DO Agent endpoint rejects system/developer messages, so when using agent
    endpoint we merge system prompt into the first user message.
    """
    client = _gradient_client()
    use_agent = _is_agent_endpoint()

    sys_text = ""
    if isinstance(system, str):
        sys_text = system
    elif isinstance(system, list):
        sys_text = "\n\n".join(b.get("text", "") for b in system if isinstance(b, dict))

    oai_messages: list[dict] = []
    if use_agent:
        # Inline system prompt into first user message
        first_user = next((m for m in messages if m["role"] == "user"), None)
        first_content = first_user["content"] if first_user else ""
        if not isinstance(first_content, str):
            first_content = json.dumps(first_content)
        merged = (
            f"# Specialist instructions\n\n{sys_text}\n\n# Task\n\n{first_content}"
            if sys_text else first_content
        )
        seen_first_user = False
        for m in messages:
            if m["role"] == "user" and not seen_first_user:
                oai_messages.append({"role": "user", "content": merged})
                seen_first_user = True
            else:
                content = m["content"] if isinstance(m["content"], str) else json.dumps(m["content"])
                oai_messages.append({"role": m["role"], "content": content})
    else:
        if sys_text:
            oai_messages.append({"role": "system", "content": sys_text})
        for m in messages:
            content = m["content"] if isinstance(m["content"], str) else json.dumps(m["content"])
            oai_messages.append({"role": m["role"], "content": content})

    extra_body: dict[str, Any] = {
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": "high" if max_tokens >= 6000 else "medium"},
    }

    resp = client.chat.completions.create(
        model=_gradient_model(model),
        max_tokens=max_tokens,
        messages=oai_messages,
        temperature=temperature,
        extra_body=extra_body,
    )
    msg = resp.choices[0].message
    text = msg.content or ""
    cost = _gradient_cost(model, resp.usage)

    # Track usage for the orchestrator
    usage = _gradient_usage_dict(model, resp.usage)
    searches = _count_tavily_searches(text)
    usage["web_searches"] = searches
    usage["web_search_cost_usd"] = searches * TAVILY_COST_PER_SEARCH
    _add_to_accumulator(usage)

    return text, [{"type": "text", "text": text}], cost + usage["web_search_cost_usd"]


def _gradient_cost(model: str, usage: Any) -> float:
    p = _PRICING.get(model)
    if not p:
        return 0.0
    inp = getattr(usage, "prompt_tokens", 0) or 0
    out = getattr(usage, "completion_tokens", 0) or 0
    cw = getattr(usage, "cache_created_input_tokens", 0) or 0
    cr = getattr(usage, "cache_read_input_tokens", 0) or 0
    inp_uncached = max(0, inp - cw - cr)
    return (inp_uncached * p[0] + cw * p[1] + cr * p[2] + out * p[3]) / 1_000_000


def _gradient_usage_dict(model: str, usage: Any) -> dict:
    """Extract token counts as a dict so the orchestrator can sum them up."""
    inp = getattr(usage, "prompt_tokens", 0) or 0
    out = getattr(usage, "completion_tokens", 0) or 0
    cw = getattr(usage, "cache_created_input_tokens", 0) or 0
    cr = getattr(usage, "cache_read_input_tokens", 0) or 0
    return {
        "input_tokens": max(0, inp - cw - cr),
        "output_tokens": out,
        "cache_write_tokens": cw,
        "cache_read_tokens": cr,
        "llm_cost_usd": _gradient_cost(model, usage),
    }


# Tavily price approximation: standard tier ~$0.005 per advanced search.
TAVILY_COST_PER_SEARCH = 0.008


def web_search_tool(max_uses: int = 5) -> dict:
    """Server-side web search tool block for the Anthropic API."""
    return {
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": max_uses,
    }


def web_fetch_tool(max_uses: int = 5) -> dict:
    """Server-side web fetch tool block for the Anthropic API."""
    return {
        "type": "web_fetch_20250910",
        "name": "web_fetch",
        "max_uses": max_uses,
        "max_content_tokens": 16000,
    }


def agent_loop(
    *,
    model: str,
    system: str,
    user_message: str,
    max_tokens: int = 8000,
    max_iterations: int = 10,
    enable_web_search: bool = True,
    enable_web_fetch: bool = True,
    extra_tools: Optional[list[dict]] = None,
    temperature: float = 0.4,
) -> tuple[str, list[dict], float]:
    """Agent loop using server-side web_search / web_fetch tools.

    The model handles search internally; we just collect the final text.

    Returns (final_text, full_message_blocks, total_cost).
    """
    if _backend() == "gradient":
        return _gradient_agent_loop(
            model=model, system=system, user_message=user_message,
            max_tokens=max_tokens, max_iterations=max_iterations,
            enable_web_search=enable_web_search, enable_web_fetch=enable_web_fetch,
            extra_tools=extra_tools, temperature=temperature,
        )

    client = _client()
    tools: list[dict] = []
    if enable_web_search:
        tools.append(web_search_tool(max_uses=6))
    if enable_web_fetch:
        tools.append(web_fetch_tool(max_uses=6))
    if extra_tools:
        tools.extend(extra_tools)

    messages = [{"role": "user", "content": user_message}]
    total_cost = 0.0
    final_text = ""
    final_blocks: list[dict] = []

    for _ in range(max_iterations):
        kwargs = dict(
            model=model,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            max_tokens=max_tokens,
            messages=messages,
        )
        if _supports_temperature(model):
            kwargs["temperature"] = temperature
        if tools:
            kwargs["tools"] = tools
        extra = _extra_headers_for(model)
        if extra:
            kwargs["extra_headers"] = extra

        resp = _create_with_retry(client, **kwargs)
        total_cost += estimate_cost(model, resp.usage)

        blocks = [b.model_dump() for b in resp.content]
        final_blocks = blocks

        if resp.stop_reason == "end_turn":
            final_text = "".join(
                b["text"] for b in blocks if b.get("type") == "text"
            )
            break

        # Anthropic resolves tool_use server-side for web_search/web_fetch — there's no
        # client-side tool_result step needed; the model continues itself if it needs
        # to. With server-side tools, end_turn is reached in a single response.
        final_text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        break

    return final_text, final_blocks, total_cost


# ─── Gradient agent loop with web_search (built-in) + web_fetch (function) ──

def _gradient_agent_loop(
    *, model: str, system: str, user_message: str, max_tokens: int,
    max_iterations: int, enable_web_search: bool, enable_web_fetch: bool,
    extra_tools: Optional[list[dict]], temperature: float,
) -> tuple[str, list[dict], float]:
    """Gradient agent loop.

    When using the DO Agent endpoint (DO_AGENT_ENDPOINT + DO_AGENT_KEY),
    web_search runs server-side automatically — the agent picks it up from
    its console-configured skills. Single-shot call is enough; no client-side
    tool loop needed.
    """
    client = _gradient_client()
    use_agent = _is_agent_endpoint()

    # DO Agent endpoint rejects system/developer messages — agent instructions
    # are fixed in DO console. Inline the system prompt into the user message.
    if use_agent:
        merged = (
            f"# Specialist instructions\n\n{system}\n\n"
            f"# Task\n\n{user_message}"
        )
        messages: list[dict] = [{"role": "user", "content": merged}]
    else:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ]

    kwargs: dict[str, Any] = dict(
        max_tokens=max_tokens,
        messages=messages,
        temperature=temperature,
    )
    # Agent endpoints often ignore the model param (it's pinned on agent
    # config), but bare inference requires it. Pass it either way.
    kwargs["model"] = _gradient_model(model)

    # Adaptive thinking: route effort by max_tokens proxy (heavy ops get high)
    effort = "high" if max_tokens >= 6000 else "medium"
    kwargs["extra_body"] = {
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": effort},
    }
    if use_agent:
        kwargs["extra_body"]["include_retrieval_info"] = True

    resp = client.chat.completions.create(**kwargs)
    cost = _gradient_cost(model, resp.usage)

    msg = resp.choices[0].message
    text = msg.content or ""

    retrieval = getattr(resp, "retrieval", None)
    if retrieval and getattr(retrieval, "retrieved_data", None):
        sources = retrieval.retrieved_data
        if sources:
            text += "\n\n---\n\n## Sources retrieved\n"
            for s in sources[:30]:
                if isinstance(s, dict):
                    text += f"- {s.get('url', '')} — {s.get('title', '')}: {s.get('snippet', '')[:200]}\n"

    # Track usage
    usage = _gradient_usage_dict(model, resp.usage)
    searches = _count_tavily_searches(text)
    usage["web_searches"] = searches
    usage["web_search_cost_usd"] = searches * TAVILY_COST_PER_SEARCH
    _add_to_accumulator(usage)

    return text, [{"type": "text", "text": text}], cost + usage["web_search_cost_usd"]
