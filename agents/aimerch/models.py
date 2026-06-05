"""Pydantic models — Company, Person, Evidence, Email, RedFlag."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

RoleCategory = Literal[
    "ceo", "owner", "president", "cfo", "coo", "vp_sales",
    "vp_ops", "director", "heir", "family_exec", "board", "founder", "other",
]

Tier = Literal["A", "B", "C", "D", "E"]
Severity = Literal["low", "medium", "high"]
FlagType = Literal["lawsuit", "death", "eeoc", "estrangement", "bankruptcy", "other"]


class Evidence(BaseModel):
    """A single fact with citation."""
    source_type: str            # web | pdf | court | eeoc | obit | linkedin | news | podcast
    source_url: Optional[str] = None
    snippet: str
    confidence: float = 0.7
    captured_at: datetime = Field(default_factory=datetime.utcnow)


class Person(BaseModel):
    full_name: str
    title: Optional[str] = None
    role_category: Optional[RoleCategory] = None
    generation: Optional[int] = None         # 1=founder, 2,3,4,5
    is_decision_maker: bool = False
    is_deceased: bool = False
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    linkedin_url: Optional[str] = None
    photo_url: Optional[str] = None    # headshot from company /team page, LinkedIn, press, or obituary
    email: Optional[str] = None
    phone: Optional[str] = None
    family_relation_to: Optional[str] = None  # legacy free-text, e.g. 'son of [Founder]'
    parent_name: Optional[str] = None          # canonical full_name of father/mother
    spouse_name: Optional[str] = None          # canonical full_name of spouse
    bio_short: Optional[str] = None
    key_facts: list[str] = Field(default_factory=list)
    # Deep profile (PersonProfileBuilder agent)
    education: list[dict] = Field(default_factory=list)            # [{school, degree, year, source_url}]
    career_summary: Optional[str] = None                            # 2-4 sentence narrative bio
    related_article_urls: list[str] = Field(default_factory=list)   # subset of company articles mentioning this person
    extra_facts: list[dict] = Field(default_factory=list)           # [{type, fact, source_url}]


class RedFlag(BaseModel):
    flag_type: FlagType
    severity: Severity
    description: str
    source_url: Optional[str] = None


class Company(BaseModel):
    slug: str
    legal_name: str
    dba: Optional[str] = None
    state: Optional[str] = None
    website: Optional[str] = None
    hq_address: Optional[str] = None
    hq_phone: Optional[str] = None
    founded_year: Optional[int] = None
    employee_count: Optional[int] = None
    account_count: Optional[int] = None
    primary_supplier: Optional[str] = None
    brands: list[str] = Field(default_factory=list)
    score: Optional[int] = None
    tier: Optional[Tier] = None
    founding_moment: Optional[str] = None
    summary: Optional[str] = None


class Email(BaseModel):
    role_category: RoleCategory
    target_person_name: str
    target_person_email: Optional[str] = None
    subject: str
    body: str
    safe_mode: bool = False           # red-flag triggered generic opener
    hook_source: Optional[str] = None # which evidence URL the hook came from
    word_count: int = 0


class Dossier(BaseModel):
    """End-to-end output of the pipeline."""
    company: Company
    people: list[Person] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    red_flags: list[RedFlag] = Field(default_factory=list)
    research_md: str = ""
    dossier_html: str = ""
    emails: list[Email] = Field(default_factory=list)
    runtime_seconds: float = 0.0
    cost_usd: float = 0.0
