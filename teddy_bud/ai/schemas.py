"""Strict validation for structured model responses."""

from __future__ import annotations

import json
from dataclasses import dataclass


class AIResponseError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Emotion:
    label: str
    intensity: float


@dataclass(frozen=True, slots=True)
class StructuredResponse:
    response: str
    emotion: Emotion
    intent: str
    memory_facts: tuple[str, ...]
    should_save_memory: bool


def parse_structured_response(raw: str | dict) -> StructuredResponse:
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(data, dict):
            raise TypeError
        required = {"response", "emotion", "intent", "memory_facts", "should_save_memory"}
        if set(data) != required or not isinstance(data["emotion"], dict):
            raise TypeError
        emotion = data["emotion"]
        if set(emotion) != {"label", "intensity"} or not isinstance(emotion["label"], str):
            raise TypeError
        intensity = emotion["intensity"]
        if isinstance(intensity, bool) or not isinstance(intensity, (int, float)) or not 0 <= intensity <= 1:
            raise ValueError
        if not isinstance(data["response"], str) or not isinstance(data["intent"], str):
            raise TypeError
        if not isinstance(data["memory_facts"], list) or not all(isinstance(item, str) for item in data["memory_facts"]):
            raise TypeError
        if not isinstance(data["should_save_memory"], bool):
            raise TypeError
        return StructuredResponse(data["response"], Emotion(emotion["label"], float(intensity)), data["intent"], tuple(data["memory_facts"]), data["should_save_memory"])
    except (TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        raise AIResponseError("The AI response did not match the expected format") from exc
