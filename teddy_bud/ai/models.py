"""Provider-neutral AI data contracts.

These contracts intentionally contain no provider credentials or NVIDIA model
identifiers. The Cloudflare Worker selects the provider model and secret.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Mapping, Sequence


class TaskType(StrEnum):
    CONVERSATION = "conversation"
    MEMORY_EXTRACTION = "memory_extraction"
    SUMMARIZATION = "summarization"
    SAFETY_REVIEW = "safety_review"


@dataclass(frozen=True, slots=True)
class AIRequest:
    task: TaskType
    messages: Sequence[Mapping[str, str]]
    memories: Sequence[str] = field(default_factory=tuple)
    request_id: str | None = None


@dataclass(frozen=True, slots=True)
class AIResponse:
    text: str
    request_id: str | None = None
    provider: str = "cloudflare_gateway"
    model_id: str | None = None

