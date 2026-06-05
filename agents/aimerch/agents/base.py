"""Base Agent class — single-LLM-call worker with structured JSON I/O."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..config import MODEL_RESEARCH, MODEL_SYNTHESIZE
from ..llm import agent_loop, chat


def extract_json(text: str) -> Any:
    """Find and parse the LARGEST valid JSON object or array in text.

    Robust to: markdown fences, prose preamble, prose postamble, multiple JSON
    blocks (returns the largest), nested braces in string fields.
    """
    if not text:
        raise ValueError("Empty text")

    candidates: list[tuple[int, Any]] = []  # (size, parsed)

    # markdown fence — try first, may have multiple
    for m in re.finditer(r"```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```", text, re.DOTALL):
        s = m.group(1)
        try:
            parsed = json.loads(s)
            candidates.append((len(s), parsed))
        except json.JSONDecodeError:
            pass

    # Balanced top-level scan, considering string contents (don't count braces inside strings)
    for opener, closer in (("[", "]"), ("{", "}")):
        i = 0
        while i < len(text):
            if text[i] == opener:
                depth = 0
                start = i
                in_str = False
                escape = False
                j = i
                while j < len(text):
                    ch = text[j]
                    if escape:
                        escape = False
                    elif ch == "\\" and in_str:
                        escape = True
                    elif ch == '"':
                        in_str = not in_str
                    elif not in_str:
                        if ch == opener:
                            depth += 1
                        elif ch == closer:
                            depth -= 1
                            if depth == 0:
                                candidate = text[start:j+1]
                                try:
                                    parsed = json.loads(candidate)
                                    candidates.append((len(candidate), parsed))
                                except json.JSONDecodeError:
                                    pass
                                i = j  # skip past
                                break
                    j += 1
            i += 1

    if not candidates:
        raise ValueError(f"No valid JSON in: {text[:300]}")
    # Return the largest match (most likely the real one)
    candidates.sort(key=lambda x: -x[0])
    return candidates[0][1]


@dataclass
class AgentResult:
    data: Any
    raw_text: str
    cost_usd: float = 0.0
    tool_blocks: list[dict] = field(default_factory=list)


class Agent:
    """Base agent: one system prompt + one LLM call per run.

    Subclasses override:
      - name: short identifier
      - model: model id (default Haiku)
      - system_prompt: full system prompt
      - build_user_message(context): constructs the user message from inputs
      - parse_output(text): converts LLM text → typed result
      - tools: 'web' (web_search + web_fetch), 'none' (pure text), or 'fetch' only
    """

    name: str = "agent"
    model: str = MODEL_SYNTHESIZE  # default; agents may override
    system_prompt: str = ""
    tools: str = "none"   # 'none' | 'web' | 'fetch'
    max_tokens: int = 8000
    temperature: float = 0.3

    def build_user_message(self, context: dict) -> str:
        return json.dumps(context, default=str)

    def parse_output(self, text: str) -> Any:
        return extract_json(text)

    def run(self, context: dict) -> AgentResult:
        msg = self.build_user_message(context)
        if self.tools in ("web", "fetch"):
            text, blocks, cost = agent_loop(
                model=self.model,
                system=self.system_prompt,
                user_message=msg,
                max_tokens=self.max_tokens,
                enable_web_search=(self.tools == "web"),
                enable_web_fetch=True,
                temperature=self.temperature,
            )
        else:
            text, blocks, cost = chat(
                model=self.model,
                system=self.system_prompt,
                messages=[{"role": "user", "content": msg}],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )
        try:
            data = self.parse_output(text)
        except Exception as e:
            data = {"error": str(e), "raw": text[:500]}
        return AgentResult(data=data, raw_text=text, cost_usd=cost, tool_blocks=blocks)
