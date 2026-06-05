"""Unit tests for aimerch.pipeline.discover.coerce_role.

The Person model uses a strict Literal enum for role_category. The LLM
sometimes returns off-schema values like 'vp_finance', 'managing_director',
'principal'. coerce_role maps these to the closest valid value so a
single bad role doesn't fail the entire run (real prod failure mode).
"""

from __future__ import annotations

import pytest

from aimerch.pipeline.discover import ALLOWED_ROLES, coerce_role


pytestmark = pytest.mark.unit


class TestCoerceRole:
    def test_none_passes_through(self):
        assert coerce_role(None) is None

    @pytest.mark.parametrize("role", sorted(ALLOWED_ROLES))
    def test_allowed_unchanged(self, role):
        assert coerce_role(role) == role

    def test_lowercase(self):
        assert coerce_role("CEO") == "ceo"

    def test_strip_whitespace(self):
        assert coerce_role("  president  ") == "president"

    def test_alias_vp_finance_to_cfo(self):
        assert coerce_role("vp_finance") == "cfo"

    def test_alias_principal_to_owner(self):
        # Real prod failure: run #28 (Premium Brands NWA) had role="principal"
        assert coerce_role("principal") == "owner"

    def test_space_dash_underscore_normalization(self):
        # 'Co Owner' / 'co-owner' / 'co_owner' all hit the same alias
        assert coerce_role("Co Owner") == "owner"
        assert coerce_role("co-owner") == "owner"
        assert coerce_role("co_owner") == "owner"

    def test_managing_director_to_director(self):
        assert coerce_role("Managing Director") == "director"

    def test_unknown_falls_to_other(self):
        # Anything not in either set defaults to "other" — never crashes
        assert coerce_role("Junior Marketing Coordinator") == "other"
        assert coerce_role("xyz") == "other"

    def test_empty_string_falls_to_other(self):
        # Empty string isn't None — must not crash; falls to "other"
        assert coerce_role("") == "other"


class TestProdRegressions:
    """Real prod failures that must stay fixed."""

    def test_run_28_principal(self):
        # Run #28 (Premium Brands NWA) failed:
        #   ValidationError: 1 validation error for Person — role_category
        # because the LLM returned "principal" for an owner-class role.
        # Fix: coerce 'principal' → 'owner'.
        assert coerce_role("principal") == "owner"

    def test_chairman_to_board(self):
        # 'Chairman' is common in older family businesses
        assert coerce_role("chairman") == "board"
        assert coerce_role("Chairperson") == "board"
