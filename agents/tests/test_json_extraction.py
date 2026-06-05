"""Unit tests for aimerch.agents.base.extract_json — the JSON extractor
that survives DO Agent's conversational preamble ('I have enough info...').

The extractor must:
- prefer markdown fences when present
- find the LARGEST balanced JSON object/array in mixed prose
- ignore braces inside JSON string values (proper escape handling)
- raise ValueError on hopeless input
"""

from __future__ import annotations

import pytest

from aimerch.agents.base import extract_json


pytestmark = pytest.mark.unit


class TestPureJson:
    def test_object(self):
        assert extract_json('{"a": 1}') == {"a": 1}

    def test_array(self):
        assert extract_json('[1, 2, 3]') == [1, 2, 3]

    def test_nested(self):
        assert extract_json('{"x": {"y": [1, 2]}}') == {"x": {"y": [1, 2]}}


class TestWithPreamble:
    def test_do_agent_chatty_preamble(self):
        # Real failure mode from prod: DO Agent narrates before producing JSON
        text = 'I have enough information now. Here is the structured data:\n{"company": {"legal_name": "Acme"}}'
        result = extract_json(text)
        assert result == {"company": {"legal_name": "Acme"}}

    def test_postamble_ignored(self):
        text = '{"a": 1}\n\nLet me know if you need anything else.'
        assert extract_json(text) == {"a": 1}


class TestMarkdownFences:
    def test_json_fence(self):
        text = "```json\n{\"a\": 1}\n```"
        assert extract_json(text) == {"a": 1}

    def test_plain_fence(self):
        text = "```\n{\"a\": 1}\n```"
        assert extract_json(text) == {"a": 1}

    def test_fence_wins_over_prose_match(self):
        # When there's both a fenced block and looser braces, fence content
        # is parsed. Both should produce valid JSON; we get the largest.
        text = 'Some text {"loose": true} and here is the real one:\n```json\n{"real": true, "with": "more data"}\n```'
        result = extract_json(text)
        assert result == {"real": True, "with": "more data"}


class TestStringAware:
    def test_braces_inside_string_value_dont_confuse_parser(self):
        # A naive depth counter would think the inner `}` closes the JSON.
        text = '{"description": "set of {curly} braces in text", "ok": true}'
        result = extract_json(text)
        assert result["description"] == "set of {curly} braces in text"
        assert result["ok"] is True

    def test_escaped_quote_in_string(self):
        text = r'{"quote": "he said \"hello\" today"}'
        result = extract_json(text)
        assert result["quote"] == 'he said "hello" today'


class TestLargestMatch:
    def test_returns_largest_when_multiple(self):
        # Tiny valid JSON `{}` exists, but a much larger one is also present.
        # extract_json returns the LARGEST.
        text = 'tiny {} here, but the real payload is {"key": "value", "list": [1,2,3,4,5]}'
        result = extract_json(text)
        assert result == {"key": "value", "list": [1, 2, 3, 4, 5]}


class TestFailures:
    def test_empty_string_raises(self):
        with pytest.raises(ValueError):
            extract_json("")

    def test_no_json_raises(self):
        with pytest.raises(ValueError, match="No valid JSON"):
            extract_json("just prose, no JSON anywhere here.")

    def test_malformed_json_raises(self):
        # `{key: value}` (unquoted key) is not valid JSON
        with pytest.raises(ValueError):
            extract_json("{key: value}")
