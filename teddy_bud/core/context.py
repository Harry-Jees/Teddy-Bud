from __future__ import annotations

from teddy_bud.ai.models import AIRequest, TaskType
from teddy_bud.security.privacy import ContextLimits, minimize_memories, minimize_messages
from teddy_bud.security.redaction import redact_secrets
from teddy_bud.core.prompts import PERSONALITY_PROMPT, SAFETY_PROMPT


def build_context(task: TaskType, messages, memories=(), *, request_id=None, limits=None) -> AIRequest:
    limits = limits or ContextLimits()
    safe_messages = tuple({"role": item["role"], "content": redact_secrets(item["content"])} for item in minimize_messages(messages, limits))
    safe_memories = tuple(redact_secrets(item) for item in minimize_memories(memories, limits))
    system = {"role": "system", "content": f"{PERSONALITY_PROMPT}\n\n{SAFETY_PROMPT}"}
    return AIRequest(task=task, messages=(system, *safe_messages), memories=safe_memories, request_id=request_id)


def build_ai_context(current_message: str, relevant_memory=(), recent_conversation=(), user_preferences=(), *, request_id=None) -> AIRequest:
    """Build only task-relevant, redacted context for a conversation request."""

    messages = list(recent_conversation)[-12:]
    messages.append({"role": "user", "content": current_message})
    if user_preferences:
        messages.insert(1, {"role": "system", "content": redact_secrets(str(user_preferences))[:1200]})
    return build_context(TaskType.CONVERSATION, messages, relevant_memory, request_id=request_id)

