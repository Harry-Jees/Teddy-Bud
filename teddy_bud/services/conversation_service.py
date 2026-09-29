from __future__ import annotations

from teddy_bud.ai.models import AIResponse, TaskType
from teddy_bud.core.context import build_context
from teddy_bud.core.safety import SafetyLayer
from teddy_bud.security.validation import validate_ai_output, validate_user_message


class ConversationService:
    def __init__(self, ai_service, repository, *, safety=None):
        self.ai_service = ai_service
        self.repository = repository
        self.safety = safety or SafetyLayer()

    def send_message(self, conversation_id: str, text: str, memories=()) -> AIResponse:
        message = validate_user_message(text)
        safety = self.safety.inspect_input(message)
        self.repository.add_message(conversation_id, "user", message)
        if safety.needs_supportive_escalation:
            answer = "I’m really sorry you’re carrying this right now. If you might act on these thoughts, please contact local emergency services or a trusted person who can stay with you."
            self.repository.add_message(conversation_id, "assistant", answer)
            return AIResponse(answer)
        recent = self.repository.recent_messages(conversation_id)
        request = build_context(TaskType.CONVERSATION, recent, memories)
        response = self.ai_service.complete(request)
        answer = validate_ai_output(response.text)
        self.safety.inspect_output(answer)
        self.repository.add_message(conversation_id, "assistant", answer)
        return AIResponse(answer, response.request_id, response.provider, response.model_id)

