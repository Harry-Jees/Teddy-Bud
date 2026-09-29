import json

import pytest

from teddy_bud.ai.schemas import AIResponseError, parse_structured_response
from teddy_bud.ai.streaming import parse_sse_lines
from teddy_bud.security.credentials import DeviceAuthenticator


def test_structured_response_is_strict():
    parsed = parse_structured_response({
        "response": "I am listening.",
        "emotion": {"label": "sad", "intensity": 0.72},
        "intent": "emotional_support",
        "memory_facts": [],
        "should_save_memory": False,
    })
    assert parsed.emotion.intensity == 0.72


@pytest.mark.parametrize("raw", ["{}", "not-json", json.dumps({"response": "x", "emotion": {"label": "sad", "intensity": 2}, "intent": "x", "memory_facts": [], "should_save_memory": False})])
def test_structured_response_rejects_invalid_data(raw):
    with pytest.raises(AIResponseError):
        parse_structured_response(raw)


def test_sse_parser_extracts_deltas():
    lines = [
        b'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
        b'data: {"choices":[{"delta":{"content":" there"}}]}\n',
        b"data: [DONE]\n",
    ]
    assert list(parse_sse_lines(lines)) == ["Hi", " there"]
