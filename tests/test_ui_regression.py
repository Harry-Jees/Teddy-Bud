import os

os.environ.setdefault("KIVY_GL_BACKEND", "angle_sdl2")

from kivy.config import Config
from kivy.clock import Clock

Config.set("graphics", "width", "1280")
Config.set("graphics", "height", "840")
Config.set("graphics", "resizable", "1")

from teddy_bud.app.app import TeddyBudApp
from teddy_bud.ui.screens import ChatScreen, _page_width
from teddy_bud.ui.theme import DURATIONS, EASINGS, animate_entrance, animate_modal, animate_press
from teddy_bud.ui.theme.tokens import COLORS, LAYOUT
from teddy_bud.ui.widgets.components import TBLoadingIndicator, TBMessageInput, ToggleSwitch, _rgb, set_text_scale, text_label


def test_fade_transition_uses_brand_background_clearcolor():
    app = TeddyBudApp()
    app.build()
    assert app.manager.transition.clearcolor == [*_rgb(COLORS["background"]), 1]


def test_toggle_switch_releases_and_flips_active_state():
    toggle = ToggleSwitch()
    assert toggle.active is False
    toggle.on_release()
    assert toggle.active is True


def test_motion_tokens_and_animation_exports():
    assert "normal" in DURATIONS
    assert "decelerate" in EASINGS
    indicator = TBLoadingIndicator()
    indicator.pulse()
    assert indicator._anim is not None
    indicator.stop_pulse()
    assert indicator._anim is None
    assert indicator.opacity == 0


def test_responsive_layout_across_aspect_ratios():
    # Ultra-narrow mobile (320px)
    assert _page_width(320) <= 288
    # Standard tablet / desktop (1280px)
    assert _page_width(1280) <= LAYOUT["content_max"]
    # Ultra-wide (2560px)
    assert _page_width(2560) == LAYOUT["content_max"]


def test_enter_to_send_setting_binds_and_unbinds_keyboard_action():
    sent = []
    composer = TBMessageInput(lambda field: sent.append(field.text), enter_to_send=False)
    composer.field.text = "A message"

    composer.set_enter_to_send(True)
    assert composer.field.multiline is False
    composer.field.dispatch("on_text_validate")
    assert sent == ["A message"]

    composer.set_enter_to_send(False)
    assert composer.field.multiline is True
    composer.field.dispatch("on_text_validate")
    assert sent == ["A message"]


def test_large_text_setting_scales_current_and_future_labels():
    label = text_label("Readable text")
    standard_size = label.font_size
    set_text_scale(1.15, label)
    assert label.font_size == standard_size * 1.15
    later_label = text_label("New screen text")
    assert later_label.font_size == standard_size * 1.15
    set_text_scale(1.0)


def test_failed_reply_keeps_exception_until_scheduled_ui_callback(monkeypatch):
    class FailedState:
        @staticmethod
        def send_message(_):
            raise RuntimeError("offline")

    class ScreenHarness:
        state = FailedState()
        finished = []

        def _finish_error(self, error, generation):
            self.finished.append((str(error), generation))

    scheduled = []
    monkeypatch.setattr(Clock, "schedule_once", lambda callback, _delay: scheduled.append(callback))
    harness = ScreenHarness()

    ChatScreen._request_reply(harness, "hello", 7)

    assert len(scheduled) == 1
    scheduled[0](0)
    assert harness.finished == [("offline", 7)]


def test_empty_state_copy_reflows_to_available_chat_width():
    from types import SimpleNamespace

    app = SimpleNamespace(
        state=SimpleNamespace(
            get_setting=lambda _key, default: default,
            messages_for=lambda: [],
        )
    )
    chat = ChatScreen(app)
    chat.scroll.width = 900
    chat._resize_messages()

    assert chat._empty_copy.text_size[0] == 360
    chat.scroll.width = 280
    chat._resize_messages()
    assert chat._empty_copy.text_size[0] == 248
