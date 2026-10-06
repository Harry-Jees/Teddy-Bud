import os
import uuid

os.environ.setdefault("KIVY_GL_BACKEND", "angle_sdl2")

from teddy_bud.app.app import TeddyBudApp
from teddy_bud.config.settings import AppSettings
from teddy_bud.app.state import AppState
from teddy_bud.ui.widgets.components import TBChatBubble, TBMessageInput, TBButton, ToggleSwitch


def test_full_chat_flow_and_persistence(tmp_path):
    # Test that chatting is 100% functional and persists messages
    unique_id = uuid.uuid4().hex
    settings = AppSettings(
        environment="test",
        debug=True,
        gateway_url="",
        database_path=tmp_path / f"test_chat_{unique_id}.sqlite3",
    )
    state = AppState(settings)
    state.initialize()

    assert state.conversation_id is not None

    # Send a message
    response = state.send_message("Hello Teddy! I'm feeling a bit tired today.")
    assert response is not None
    assert response.text != ""
    assert isinstance(response.text, str)

    # Verify messages in DB
    messages = state.messages_for()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert "tired" in messages[0]["content"]
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["content"]) > 0


def test_app_screen_navigation_and_memory_flow(tmp_path):
    unique_id = uuid.uuid4().hex
    settings = AppSettings(
        environment="test",
        debug=True,
        gateway_url="",
        database_path=tmp_path / f"test_nav_{unique_id}.sqlite3",
    )
    app = TeddyBudApp()
    app.settings = settings
    app.state = AppState(settings)
    app.state.initialize()
    root = app.build()

    # Verify navigation between screens
    for page in ("chat", "memory", "privacy", "settings", "chat"):
        app.open_page(page)
        assert app.manager.current == page

    # Verify memory actions
    app.state.memory_service.remember("Favorite tea is chamomile")
    memories = app.state.memory_service.list()
    assert len(memories) == 1
    assert "chamomile" in memories[0]["content"]

    app.state.memory_service.update(memories[0]["id"], "Favorite tea is Earl Grey")
    updated = app.state.memory_service.list()
    assert "Earl Grey" in updated[0]["content"]

    app.state.memory_service.forget(memories[0]["id"])
    assert len(app.state.memory_service.list()) == 0


def test_widget_rendering_and_components():
    bubble = TBChatBubble("Hello from user", is_user=True)
    assert bubble.height > 0
    assert bubble.width > 0

    teddy_bubble = TBChatBubble("Hello from Teddy", is_user=False)
    assert teddy_bubble.height > 0

    btn = TBButton(text="Action", primary=True)
    assert btn.color[3] == 1.0  # Full alpha
    assert btn.height >= 44     # Touch target compliance
