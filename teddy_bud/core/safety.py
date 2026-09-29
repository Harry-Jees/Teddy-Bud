"""Independent safety boundary, separate from Teddy's personality prompt."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SafetyResult:
    allowed: bool
    needs_supportive_escalation: bool = False


class SafetyLayer:
    _high_risk_terms = ("suicide", "kill myself", "self-harm", "hurt myself")

    def inspect_input(self, text: str) -> SafetyResult:
        lowered = text.casefold()
        return SafetyResult(True, any(term in lowered for term in self._high_risk_terms))

    def inspect_output(self, text: str) -> SafetyResult:
        return SafetyResult(bool(text.strip()))

