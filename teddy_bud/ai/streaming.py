"""OpenAI-compatible Server-Sent Events parsing for Kivy-safe consumers."""

from __future__ import annotations

import json


class StreamParseError(ValueError):
    pass


def parse_sse_lines(lines):
    for raw_line in lines:
        line = raw_line.decode("utf-8", errors="strict") if isinstance(raw_line, bytes) else raw_line
        line = line.strip()
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload == "[DONE]":
            return
        try:
            data = json.loads(payload)
            choices = data.get("choices", [])
            if choices:
                delta = choices[0].get("delta", {})
                content = delta.get("content")
                if isinstance(content, str):
                    yield content
        except (json.JSONDecodeError, AttributeError, TypeError) as exc:
            raise StreamParseError("The gateway stream was malformed") from exc
