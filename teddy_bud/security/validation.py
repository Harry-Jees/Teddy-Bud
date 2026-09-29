"""Input and output validation at the application boundary."""

from __future__ import annotations


class ValidationError(ValueError):
    pass


def validate_user_message(text: str) -> str:
    value = text.strip()
    if not value:
        raise ValidationError("Message cannot be empty")
    if len(value) > 4000:
        raise ValidationError("Message is too long")
    return value


def validate_ai_output(text: str) -> str:
    value = text.strip()
    if not value:
        raise ValidationError("The conversation service returned an empty response")
    return value[:12000]

