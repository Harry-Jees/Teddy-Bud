"""Gateway AI data contracts."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Mapping, Sequence


class TaskType(StrEnum):
    CONVERSATION = "conversation"
    MEMORY_EXTRACTION = "memory_extraction"
    SUMMARIZATION = "summarization"
    SAFETY_REVIEW = "safety_review"


class ModelPurpose(StrEnum):
    EMOTIONAL_CONVERSATION = "emotional_conversation"
    FAST_CONVERSATION = "fast_conversation"
    STRUCTURED_EXTRACTION = "structured_extraction"
    MULTIMODAL = "multimodal"


@dataclass(frozen=True, slots=True)
class ModelConfig:
    model_id: str
    purpose: ModelPurpose


@dataclass(frozen=True, slots=True)
class AIRequest:
    task: TaskType
    messages: Sequence[Mapping[str, str]]
    memories: Sequence[str] = field(default_factory=tuple)
    request_id: str | None = None
    model_id: str | None = None
    stream: bool = False


@dataclass(frozen=True, slots=True)
class AIResponse:
    text: str
    request_id: str | None = None
    provider: str = "cloudflare_gateway"
    model_id: str | None = None

