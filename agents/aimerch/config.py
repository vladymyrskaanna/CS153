"""Runtime configuration: env vars, paths, model IDs."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
__all__ = ["ROOT", "DOSSIERS_DIR", "DATA_DIR", "DB_PATH", "anthropic_auth", "OPERATOR", "NBWA_DATE_LINE", "MODEL_SYNTHESIZE", "MODEL_RESEARCH", "MODEL_EXTRACT"]
PROMPTS_DIR = ROOT / "prompts"
DOSSIERS_DIR = ROOT / "dossiers"
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "aimerch.db"

DOSSIERS_DIR.mkdir(exist_ok=True, parents=True)
DATA_DIR.mkdir(exist_ok=True, parents=True)

load_dotenv(ROOT / ".env")


def anthropic_auth() -> dict:
    """Return kwargs for Anthropic() client.

    Prefer ANTHROPIC_API_KEY. Fall back to CLAUDE_CODE_OAUTH_TOKEN (dev only —
    when running inside Claude Code with an active session).
    """
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return {"api_key": key}
    oauth = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "").strip()
    if oauth:
        return {"auth_token": oauth}
    raise RuntimeError(
        "No Anthropic credentials. Set ANTHROPIC_API_KEY in .env or "
        "run inside an active Claude Code session."
    )


MODEL_SYNTHESIZE = os.environ.get("MODEL_SYNTHESIZE", "claude-opus-4-7")
MODEL_RESEARCH = os.environ.get("MODEL_RESEARCH", "claude-sonnet-4-6")
MODEL_EXTRACT = os.environ.get("MODEL_EXTRACT", "claude-haiku-4-5-20251001")

OPERATOR = {
    "name": os.environ.get("OPERATOR_NAME", "Anna"),
    "title": os.environ.get("OPERATOR_TITLE", "Founder"),
    "mobile": os.environ.get("OPERATOR_MOBILE", ""),
    "web": os.environ.get("OPERATOR_WEB", ""),
}

NBWA_DATE_LINE = os.environ.get("NBWA_DATE_LINE", "starting this Sunday")
