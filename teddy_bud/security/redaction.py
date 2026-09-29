"""Redaction helpers for data that may be sent to a remote service."""

from __future__ import annotations

import re


_SECRET_PATTERNS = (
    re.compile(r"(?i)\b(api[_ -]?key|token|secret|password)\s*[:=]\s*[^\s,]+"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
)


def redact_secrets(text: str) -> str:
    result = text
    for pattern in _SECRET_PATTERNS:
        result = pattern.sub("[redacted]", result)
    return result

