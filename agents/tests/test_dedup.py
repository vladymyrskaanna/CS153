"""Unit tests for aimerch.dedup.normalize_name — name canonicalization
that prevents the LLM from creating duplicate Person rows like
'W. Rockwell "Rocky" Wirtz' vs 'W. Rockwell Wirtz'.
"""

from __future__ import annotations

import pytest

from aimerch.dedup import normalize_name, first_last


pytestmark = pytest.mark.unit


class TestNormalizeName:
    def test_empty(self):
        assert normalize_name("") == ""
        assert normalize_name(None) == ""  # type: ignore

    def test_simple_name(self):
        assert normalize_name("John Smith") == "john smith"

    def test_strips_quoted_nickname(self):
        assert normalize_name('Jeffrey "Jeff" Vukelic') == "jeffrey vukelic"

    def test_strips_single_quoted_nickname(self):
        assert normalize_name("Jeffrey 'Jeff' Vukelic") == "jeffrey vukelic"

    def test_strips_paren_nickname(self):
        assert normalize_name("Jeffrey (Jeff) Vukelic") == "jeffrey vukelic"

    def test_strips_middle_initial(self):
        assert normalize_name("W. Rockwell Wirtz") == "rockwell wirtz"

    def test_strips_jr_suffix(self):
        assert normalize_name("John Smith Jr.") == "john smith"

    def test_strips_roman_numeral_suffix(self):
        assert normalize_name("John Smith III") == "john smith"

    def test_strips_honorific(self):
        assert normalize_name("Dr. John Smith") == "john smith"

    def test_combined(self):
        # The full Wirtz fixture from the Saratoga research
        assert (
            normalize_name('W. Rockwell "Rocky" Wirtz Jr.')
            == "rockwell wirtz"
        )

    def test_two_variants_match(self):
        # Different surface forms must collapse to the same canonical name
        a = normalize_name('W. Rockwell "Rocky" Wirtz')
        b = normalize_name("Rockwell Wirtz")
        c = normalize_name("W. Rockwell Wirtz Jr.")
        assert a == b == c


class TestFirstLast:
    def test_simple(self):
        # first_last applies normalize_name → returns lowercase tokens
        assert first_last("John Smith") == ("john", "smith")

    def test_three_part_name(self):
        first, last = first_last("John David Smith")
        assert last == "smith"

    def test_single_word(self):
        first, last = first_last("Madonna")
        assert isinstance(first, str)
        assert isinstance(last, str)

    def test_empty(self):
        first, last = first_last("")
        assert first == "" and last == ""

    def test_case_insensitive_consistency(self):
        # Whatever case is returned, it must be consistent across inputs
        assert first_last("JOHN SMITH") == first_last("john smith") == first_last("John Smith")
