from __future__ import annotations

from dataclasses import replace

from teddy_bud.ai.models import AIResponse, TaskType
from teddy_bud.core.companion import generate_companion_reply
from teddy_bud.core.context import build_context
from teddy_bud.core.safety import SafetyLayer
from teddy_bud.security.validation import validate_ai_output, validate_user_message


class ConversationService:
    def __init__(self, ai_service, repository, *, safety=None, fallback: bool = False):
        self.ai_service = ai_service
        self.repository = repository
        self.safety = safety or SafetyLayer()
        self.fallback = fallback

    def send_message(self, conversation_id: str, text: str, memories=(), response_style: str = "balanced") -> AIResponse:
        message = validate_user_message(text)
        safety = self.safety.inspect_input(message)
        user_message_id = self.repository.add_message(conversation_id, "user", message)
        if safety.needs_supportive_escalation:
            answer = "I'm really sorry you're carrying this right now. If you might act on these thoughts, please contact local emergency services or a trusted person who can stay with you."
            self.repository.add_message(conversation_id, "assistant", answer)
            return AIResponse(answer)
        try:
            recent = self.repository.recent_messages(conversation_id)
            request = build_context(TaskType.CONVERSATION, recent, memories)
            style_instructions = {
                "brief": "Keep the response especially concise while still sounding warm.",
                "reflective": "Take a little more time to acknowledge the user's feelings before offering thoughts.",
            }
            instruction = style_instructions.get(response_style)
            if instruction:
                messages = list(request.messages)
                messages[0] = {**messages[0], "content": messages[0]["content"] + "\n\n" + instruction}
                request = replace(request, messages=tuple(messages))
            try:
                response = self.ai_service.complete(request)
                answer = validate_ai_output(response.text)
                safety_result = self.safety.inspect_output(answer)
                if not safety_result.allowed:
                    raise ValueError("The conversation service returned an unsafe response")
                self.repository.add_message(conversation_id, "assistant", answer)
                return AIResponse(answer, response.request_id, response.provider, response.model_id)
            except Exception as exc:
                if not self.fallback:
                    raise
                # Graceful offline companion fallback for uninterrupted user experience
                companion_text = generate_companion_reply(
                    text,
                    memories=tuple(memories),
                    response_style=response_style,
                )
                self.repository.add_message(conversation_id, "assistant", companion_text)
                return AIResponse(companion_text, provider="companion", model_id="teddy-bud-companion")
        except Exception:
            # A failed send is removed so retrying cannot duplicate the user turn.
            self.repository.delete_message(user_message_id)
            raise
