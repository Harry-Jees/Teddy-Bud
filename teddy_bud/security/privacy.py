"""Privacy policy primitives shared by the context builder and services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True, slots=True)
class ContextLimits:
    recent_messages: int = 12
    memories: int = 5
    memory_characters: int = 1200
    message_characters: int = 4000


def minimize_messages(messages: Iterable[dict[str, str]], limits: ContextLimits) -> tuple[dict[str, str], ...]:
    selected = list(messages)[-limits.recent_messages :]
    return tuple(
        {"role": item.get("role", "user"), "content": item.get("content", "")[: limits.message_characters]}
        for item in selected
    )


def minimize_memories(memories: Iterable[str], limits: ContextLimits) -> tuple[str, ...]:
    return tuple(memory[: limits.memory_characters] for memory in list(memories)[: limits.memories])

