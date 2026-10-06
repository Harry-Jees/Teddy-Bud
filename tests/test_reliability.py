import pytest

from teddy_bud.ai.models import AIResponse
from teddy_bud.services.conversation_service import ConversationService
from teddy_bud.security.transport import GatewayResponseError


class FakeRepository:
    def __init__(self):
        self.messages = []
        self.deleted = []

    def add_message(self, conversation_id, role, content):
        message_id = f"message-{len(self.messages)}"
        self.messages.append((message_id, role, content))
        return message_id

    def delete_message(self, message_id):
        self.deleted.append(message_id)
        self.messages = [row for row in self.messages if row[0] != message_id]

    def recent_messages(self, conversation_id):
        return [{"role": role, "content": content} for _, role, content in self.messages]


class FailingAI:
    def complete(self, request):
        raise RuntimeError("gateway unavailable")


class WorkingAI:
    def complete(self, request):
        return AIResponse("Hello back")


def test_failed_send_rolls_back_user_message_for_retry():
    repository = FakeRepository()
    service = ConversationService(FailingAI(), repository)

    with pytest.raises(RuntimeError):
        service.send_message("conversation", "hello")

    assert repository.messages == []
    assert repository.deleted == ["message-0"]


def test_successful_send_persists_one_user_and_one_assistant_message():
    repository = FakeRepository()
    response = ConversationService(WorkingAI(), repository).send_message("conversation", "hello")

    assert response.text == "Hello back"
    assert [(role, content) for _, role, content in repository.messages] == [
        ("user", "hello"),
        ("assistant", "Hello back"),
    ]


def test_gateway_json_contract_rejects_non_object_response():
    from teddy_bud.security.transport import _require_object

    with pytest.raises(GatewayResponseError):
        _require_object([], operation="JSON")
