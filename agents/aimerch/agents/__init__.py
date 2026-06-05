"""Multi-agent research pipeline.

Each agent is a focused LLM call with a single responsibility:

    [1] PhotoFinder     — hunts headshots for the discovered people list
    [2] ArticleHunter   — finds press / obituaries / podcasts / alumni mags
    [3] FactBuilder     — extracts structured facts with verbatim citations
    [4] Validator       — drops unsourced or low-confidence facts
    [5] HookSpecialist  — picks the BEST opener per email role
    [6] EmailWriter     — writes 6-paragraph emails using chosen hooks
    [7] EmailValidator  — final sanity check; every claim traces to a fact_id

Each agent has a strict JSON schema input/output, can be tested in isolation,
and contributes one slice of the final dossier.
"""

from .base import Agent, AgentResult
from .photo_finder import PhotoFinder
from .photo_resolver import PhotoResolver
from .person_profile_builder import PersonProfileBuilder
from .article_hunter import ArticleHunter
from .fact_builder import FactBuilder
from .validator import FactValidator
from .relationship_resolver import RelationshipResolver
from .hook_specialist import HookSpecialist
from .email_writer import EmailWriter
from .email_validator import EmailValidator

__all__ = [
    "Agent", "AgentResult",
    "PhotoFinder", "PhotoResolver", "PersonProfileBuilder",
    "ArticleHunter", "FactBuilder", "FactValidator",
    "RelationshipResolver",
    "HookSpecialist", "EmailWriter", "EmailValidator",
]
