from __future__ import annotations

from datetime import datetime

from kivy.clock import Clock
from kivy.core.window import Window
from kivy.metrics import dp, sp
from kivy.uix.anchorlayout import AnchorLayout
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.modalview import ModalView
from kivy.uix.screenmanager import Screen
from kivy.uix.scrollview import ScrollView
from kivy.uix.textinput import TextInput
from kivy.uix.widget import Widget

from teddy_bud.ui.theme.tokens import COLORS, FONT_SECONDARY, LAYOUT, RADII, SPACING, TYPE_SCALE
from teddy_bud.ai.providers.cloudflare import GatewayError
from teddy_bud.security.transport import (
    AuthenticationError,
    GatewayResponseError,
    GatewayUnavailableError,
    ModelUnavailableError,
    NetworkError,
    RateLimitError,
)
from teddy_bud.ui.widgets.components import (
    TBButton,
    TBCard,
    TBChatBubble,
    TBLoadingIndicator,
    TBMessageInput,
    TBSectionHeader,
    TeddyAvatar,
    text_label,
    _rgb,
    get_text_scale,
)


def _thin_rule():
    return Widget(size_hint_y=None, height=dp(1))


def _section_title(title: str, description: str = "") -> BoxLayout:
    section = BoxLayout(orientation="vertical", size_hint_y=None, spacing=dp(SPACING["micro"]))
    heading = text_label(title, style="title_medium", size_hint_y=None, height=dp(28))
    section.add_widget(heading)
    if description:
        body = text_label(description, style="body_medium", color=COLORS["muted_text"], size_hint_y=None)
        body.text_size = (None, None)
        section.add_widget(body)
        body.bind(texture_size=lambda widget, size: setattr(widget, "height", size[1]))
    section.bind(minimum_height=section.setter("height"))
    return section


def _vertical_page(title: str, subtitle: str = ""):
    root = BoxLayout(orientation="vertical", spacing=dp(SPACING["md"]), padding=[dp(SPACING["md"]), dp(SPACING["md"]), dp(SPACING["md"]), dp(SPACING["md"])])
    heading = BoxLayout(orientation="vertical", size_hint_y=None, height=dp(72 if subtitle else 44), spacing=dp(SPACING["micro"]))
    heading.add_widget(TBSectionHeader(text=title, size_hint_y=None, height=dp(36)))
    if subtitle:
        heading.add_widget(text_label(subtitle, style="body_medium", color=COLORS["muted_text"], size_hint_y=None, height=dp(24)))
    root.add_widget(heading)
    return root


def _page_width(available_width: float, *, min_width: float = dp(280), max_width: float = dp(LAYOUT["content_max"])) -> float:
    # Keep the 16dp side margins when possible, but never overflow a narrow
    # split-screen or phone window.
    usable = max(0, available_width - dp(32))
    return min(max_width, max(min_width, usable)) if usable >= min_width else usable


def _friendly_gateway_error(error: Exception | None, startup_message: str | None = None) -> str:
    if startup_message and (error is None or str(error) == startup_message):
        return startup_message
    if isinstance(error, AuthenticationError):
        return "Teddy needs to reconnect securely before responding. Try again in a moment."
    if isinstance(error, (NetworkError, TimeoutError)):
        return "Teddy couldn't reach the conversation service. Check your connection and try again."
    if isinstance(error, RateLimitError):
        return "The conversation service is busy. Please try again shortly."
    if isinstance(error, (ModelUnavailableError, GatewayUnavailableError, GatewayResponseError, GatewayError)):
        return "The conversation service is unavailable right now. Please try again shortly."
    return "Teddy couldn't respond right now. Please try again."


class TeddyDialog(ModalView):
    def __init__(self, title: str, body: str, *, actions=(), content=None, **kwargs):
        kwargs.setdefault("size_hint", (None, None))
        kwargs.setdefault("width", max(dp(1), min(dp(440), Window.width - dp(32))))
        kwargs.setdefault("height", dp(300 if content is None else 380))
        kwargs.setdefault("background", "")
        kwargs.setdefault("background_color", (0, 0, 0, 0))
        kwargs.setdefault("overlay_color", (0.17, 0.14, 0.12, 0.35))
        kwargs.setdefault("auto_dismiss", False)
        super().__init__(**kwargs)
        panel = TBCard(orientation="vertical", padding=dp(SPACING["xl"]), spacing=dp(SPACING["md"]), radius="hero")
        panel.add_widget(text_label(title, style="headline_medium", size_hint_y=None, height=dp(36)))
        copy = text_label(body, style="body_large", color=COLORS["muted_text"], valign="top", size_hint_y=None)
        copy.text_size = (self.width - dp(64), None)
        copy.bind(texture_size=lambda widget, size: setattr(widget, "height", size[1]))
        panel.add_widget(copy)
        if content is not None:
            panel.add_widget(content)
        if actions:
            row = BoxLayout(size_hint_y=None, height=dp(48), spacing=dp(SPACING["xs"]))
            for label, callback, style in actions:
                button = TBButton(text=label, primary=style == "primary", destructive=style == "destructive", quiet=style == "quiet")
                button.bind(on_release=lambda _, action=callback: self._run(action))
                row.add_widget(button)
            panel.add_widget(row)
        self.add_widget(panel)

    def _run(self, callback):
        self.dismiss()
        if callback:
            callback()


class TextEntryDialog(TeddyDialog):
    def __init__(self, title: str, body: str, *, initial_text: str = "", save_label: str = "Save", on_save=None, **kwargs):
        self._on_save = on_save
        self._entry = TextInput(
            text=initial_text,
            hint_text="Write a short detail...",
            multiline=True,
            font_size=sp(TYPE_SCALE["body_large"][0]) * get_text_scale(),
            font_name="Plus Jakarta Sans",
            foreground_color=_rgb(COLORS["text"]),
            hint_text_color=_rgb(COLORS["muted_text"]),
            cursor_color=_rgb(COLORS["primary"]),
            background_normal="",
            background_active="",
            background_color=_rgb(COLORS["background"]),
            padding=dp(SPACING["md"]),
            size_hint_y=None,
            height=dp(104),
        )
        self._entry._tb_base_font_size = self._entry.font_size / get_text_scale()
        super().__init__(
            title,
            body,
            content=self._entry,
            actions=(("Not now", None, "quiet"), (save_label, self._save, "primary")),
            height=dp(420),
            **kwargs,
        )

    def _save(self):
        value = self._entry.text.strip()
        if value and self._on_save:
            self._on_save(value)


class OnboardingScreen(Screen):
    def __init__(self, app, **kwargs):
        super().__init__(**kwargs)
        self.app = app
        self.step = 0
        self.root_layout = BoxLayout(orientation="vertical", padding=[dp(SPACING["md"]), dp(SPACING["md"])])
        self.add_widget(self.root_layout)
        self._layout_width = 0
        self.bind(size=self._size_changed)
        self.render()

    def _size_changed(self, *_):
        width = min(dp(520), max(dp(280), self.width - dp(32)))
        if abs(width - self._layout_width) > dp(2):
            self._layout_width = width
            Clock.schedule_once(lambda *_: self.render(), 0)

    def render(self):
        self.root_layout.clear_widgets()
        top = BoxLayout(size_hint_y=None, height=dp(56), spacing=dp(SPACING["xs"]))
        top.add_widget(TeddyAvatar())
        top.add_widget(text_label("Teddy Bud", style="title_medium"))
        top.add_widget(Widget())
        if self.step:
            back = TBButton(text="Back", quiet=True, size_hint_x=None, width=dp(72), height=dp(44))
            back.bind(on_release=lambda *_: self._previous())
            top.add_widget(back)
        self.root_layout.add_widget(top)

        center = AnchorLayout(anchor_x="center", anchor_y="center")
        content_width = _page_width(self.width, max_width=dp(520))
        content = BoxLayout(orientation="vertical", size_hint=(None, None), width=content_width, spacing=dp(SPACING["md"]))
        content.bind(minimum_height=content.setter("height"))
        if self.step == 0:
            hero = TeddyAvatar(size_dp=96, size_hint=(None, None), size=(dp(96), dp(96)))
            content.add_widget(AnchorLayout(anchor_x="center", size_hint_y=None, height=dp(112), children=[hero]))
            title = text_label("Hi, I'm Teddy.", style="display_medium", size_hint_y=None, height=dp(48), halign="center", font_name=FONT_SECONDARY)
            content.add_widget(title)
            content.add_widget(text_label("A quiet place to talk through whatever is on your mind.", style="body_large", color=COLORS["muted_text"], size_hint_y=None, height=dp(52), halign="center", text_size=(content_width - dp(24), None)))
        elif self.step == 1:
            content.add_widget(text_label("Your privacy matters.", style="headline_large", size_hint_y=None, height=dp(40), halign="center", font_name=FONT_SECONDARY))
            content.add_widget(text_label("Your conversation history and approved memories are stored in an encrypted database on this device. When you ask Teddy for a reply, relevant recent context is sent through our Cloudflare gateway to the AI model provider.", style="body_large", color=COLORS["muted_text"], size_hint_y=None, height=dp(168), halign="center", valign="top", text_size=(content_width - dp(24), None)))
            content.add_widget(text_label("You can review or delete local data any time in Privacy.", style="body_medium", color=COLORS["text"], size_hint_y=None, height=dp(48), halign="center", text_size=(content_width - dp(24), None)))
        else:
            content.add_widget(text_label("Ready when you are.", style="headline_large", size_hint_y=None, height=dp(44), halign="center", font_name=FONT_SECONDARY))
            content.add_widget(text_label("There is no right way to start. A few words are enough.", style="body_large", color=COLORS["muted_text"], size_hint_y=None, height=dp(56), halign="center", text_size=(content_width - dp(24), None)))
        center.add_widget(content)
        self.root_layout.add_widget(center)

        footer = BoxLayout(orientation="vertical", size_hint_y=None, height=dp(104), spacing=dp(SPACING["xs"]))
        dots = text_label("●  ○  ○" if self.step == 0 else ("○  ●  ○" if self.step == 1 else "○  ○  ●"), style="label_large", color=COLORS["primary"], size_hint_y=None, height=dp(28), halign="center")
        footer.add_widget(dots)
        action_text = "Start talking" if self.step == 2 else "Continue"
        action = TBButton(text=action_text, primary=True, size_hint_y=None, height=dp(48))
        action.bind(on_release=lambda *_: self._next())
        footer.add_widget(action)
        self.root_layout.add_widget(footer)

    def _previous(self):
        self.step = max(0, self.step - 1)
        self.render()

    def _next(self):
        if self.step < 2:
            self.step += 1
            self.render()
            return
        self.app.state.set_setting("onboarding_complete", "true")
        self.app.open_page("chat")


class ChatScreen(Screen):
    def __init__(self, app, **kwargs):
        super().__init__(**kwargs)
        self.app = app
        self.state = app.state
        self._loading = False
        self._pending_text = None
        self._request_generation = 0
        self._retry_count = 0
        self._empty_state_active = False
        self._empty_copy = None
        self.root_layout = BoxLayout(orientation="vertical", padding=[dp(SPACING["md"]), dp(SPACING["xs"]), dp(SPACING["md"]), dp(SPACING["xs"])], spacing=dp(SPACING["xs"]))

        header = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(64), spacing=dp(SPACING["xs"]))
        header.add_widget(TeddyAvatar())
        title_stack = BoxLayout(orientation="vertical", spacing=dp(SPACING["micro"]))
        title_stack.add_widget(text_label("Teddy Bud", style="title_small", size_hint_y=None, height=dp(22)))
        title_stack.add_widget(text_label("A private space to talk", style="body_small", color=COLORS["muted_text"], size_hint_y=None, height=dp(18)))
        header.add_widget(title_stack)
        header.add_widget(Widget())
        history = TBButton(text="History", quiet=True, size_hint=(None, None), size=(dp(84), dp(44)))
        history.bind(on_release=lambda *_: self.show_history())
        header.add_widget(history)
        new_chat = TBButton(text="New chat", primary=True, size_hint=(None, None), size=(dp(104), dp(44)))
        new_chat.bind(on_release=lambda *_: self.new_chat())
        header.add_widget(new_chat)
        self._header = header
        self._header_title = title_stack
        self._history_button = history
        self._new_chat_button = new_chat
        self.bind(size=self._adapt_header)
        self._adapt_header()
        self.root_layout.add_widget(header)

        self.scroll = ScrollView(do_scroll_x=False, bar_width=dp(3), scroll_type=["bars", "content"], bar_color=_rgb(COLORS["primary"]), bar_inactive_color=_rgb(COLORS["divider"]))
        self.messages = BoxLayout(orientation="vertical", size_hint_y=None, spacing=dp(SPACING["xs"]), padding=[dp(SPACING["xs"]), dp(SPACING["md"])])
        self.messages.bind(minimum_height=self._sync_messages_height)
        self.scroll.add_widget(self.messages)
        self.scroll.bind(size=lambda *_: self._resize_messages())
        self.root_layout.add_widget(self.scroll)

        self.status = TBLoadingIndicator(opacity=0, disabled=True)
        self.root_layout.add_widget(self.status)
        self.composer = TBMessageInput(self.send, enter_to_send=self.state.get_setting("enter_to_send", "true") == "true")
        self.root_layout.add_widget(self.composer)
        self.add_widget(self.root_layout)
        self.bind(on_pre_enter=lambda *_: self.refresh())
        self.refresh()

    def _adapt_header(self, *_):
        """Keep the header usable in narrow split-screen windows."""
        width = self.width
        compact = width < dp(400)
        self._header_title.width = dp(82 if compact else 160)
        self._header_title.size_hint_x = None
        self._history_button.width = dp(64 if compact else 84)
        self._new_chat_button.width = dp(64 if compact else 104)
        if compact:
            self._new_chat_button.text = "New"
        else:
            self._new_chat_button.text = "New chat"

    def _sync_messages_height(self, *_):
        self.messages.height = max(self.messages.minimum_height, self.scroll.height)

    def _resize_messages(self):
        self.messages.width = self.scroll.width
        if self._empty_copy is not None and self._empty_state_active:
            self._resize_empty_copy()
        for row in self.messages.children:
            if getattr(row, "message_row", None):
                row.width = self.scroll.width
                row.message_row.width = min(self.scroll.width, dp(LAYOUT["content_max"]))
                if getattr(row.message_row, "bubble", None):
                    row.message_row.bubble.width = self._bubble_width(row.text, row.is_user)
            elif getattr(row, "time_row", None):
                row.width = self.scroll.width
                row.time_row.width = min(self.scroll.width, dp(LAYOUT["content_max"]))
        self._sync_messages_height()

    def _resize_empty_copy(self, *_):
        width = max(dp(1), min(dp(360), self.scroll.width - dp(32)))
        self._empty_copy.text_size = (width, None)
        self._empty_copy.height = max(dp(52), self._empty_copy.texture_size[1])

    def _bubble_width(self, text: str, is_user: bool) -> float:
        available = max(dp(1), self.scroll.width - dp(SPACING["md"] * 2))
        ratio = 0.78 if is_user else 0.82
        maximum = min(dp(LAYOUT["content_max"]) * ratio, available * ratio)
        longest_line = max((len(line) for line in text.splitlines()), default=8)
        natural = dp(40) + min(longest_line, 72) * sp(TYPE_SCALE["body_large"][0]) * 0.48
        return min(maximum, max(min(dp(104), maximum), natural))

    def _add_message(self, text: str, *, is_user: bool, rememberable: bool = False, timestamp: str | None = None):
        row = BoxLayout(orientation="horizontal", size_hint=(None, None), width=min(self.scroll.width, dp(LAYOUT["content_max"])), height=dp(48), spacing=dp(SPACING["xs"]))
        bubble = TBChatBubble(
            text,
            is_user=is_user,
            show_remember=rememberable,
            on_remember=self.ask_remember if rememberable else None,
            size=(self._bubble_width(text, is_user), dp(48)),
        )
        row.text = text
        row.is_user = is_user
        row.bubble = bubble
        if is_user:
            row.add_widget(Widget())
            row.add_widget(bubble)
        else:
            row.add_widget(bubble)
            row.add_widget(Widget())
        bubble.bind(height=lambda _, value: setattr(row, "height", value))
        row_wrapper = AnchorLayout(anchor_x="center", size_hint=(None, None), width=self.scroll.width, height=row.height)
        row_wrapper.message_row = row
        row_wrapper.text = text
        row_wrapper.is_user = is_user
        row_wrapper.add_widget(row)
        bubble.bind(height=lambda _, value: setattr(row_wrapper, "height", value))
        self.messages.add_widget(row_wrapper)
        if self.state.get_setting("show_timestamps", "false") == "true":
            shown_time = timestamp
            if shown_time:
                try:
                    shown_time = datetime.fromisoformat(shown_time).astimezone().strftime("%H:%M")
                except ValueError:
                    shown_time = None
            time_row = BoxLayout(orientation="horizontal", size_hint=(None, None), width=min(self.scroll.width, dp(LAYOUT["content_max"])), height=dp(20))
            time_label = text_label(shown_time or datetime.now().astimezone().strftime("%H:%M"), style="label_small", color=COLORS["muted_text"], size_hint=(None, 1), width=dp(64), halign="right" if is_user else "left")
            if is_user:
                time_row.add_widget(Widget())
                time_row.add_widget(time_label)
            else:
                time_row.add_widget(time_label)
                time_row.add_widget(Widget())
            time_wrapper = AnchorLayout(anchor_x="center", size_hint=(None, None), width=self.scroll.width, height=dp(20))
            time_wrapper.time_row = time_row
            time_wrapper.add_widget(time_row)
            self.messages.add_widget(time_wrapper)
        Clock.schedule_once(lambda *_: setattr(self.scroll, "scroll_y", 0), 0)
        return row

    def _empty_state(self):
        box = BoxLayout(orientation="vertical", size_hint_y=None, height=max(dp(360), self.scroll.height - dp(24)), spacing=dp(SPACING["md"]))
        box.add_widget(Widget())
        avatar = TeddyAvatar(size_dp=96, size_hint=(None, None), size=(dp(96), dp(96)))
        box.add_widget(AnchorLayout(anchor_x="center", size_hint_y=None, height=dp(104), children=[avatar]))
        box.add_widget(text_label("Hi, I'm Teddy.", style="headline_large", font_name=FONT_SECONDARY, size_hint_y=None, height=dp(40), halign="center"))
        self._empty_copy = text_label(
            "You can talk to me about whatever is on your mind.",
            style="body_large",
            color=COLORS["muted_text"],
            size_hint_y=None,
            height=dp(52),
            halign="center",
        )
        self._empty_copy.bind(texture_size=self._resize_empty_copy)
        box.add_widget(self._empty_copy)
        self._resize_empty_copy()
        start = TBButton(text="Start talking", primary=True, size_hint=(None, None), size=(dp(176), dp(48)))
        start.bind(on_release=lambda *_: setattr(self.composer.field, "focus", True))
        box.add_widget(AnchorLayout(anchor_x="center", size_hint_y=None, height=dp(48), children=[start]))
        box.add_widget(Widget())
        return box

    def refresh(self):
        self.messages.clear_widgets()
        records = self.state.messages_for()
        if not records:
            self._empty_state_active = True
            self.messages.add_widget(self._empty_state())
        else:
            self._empty_state_active = False
            self._empty_copy = None
            for item in records:
                self._add_message(item["content"], is_user=item["role"] == "user", rememberable=item["role"] == "user", timestamp=item.get("created_at"))
        self._resize_messages()

    def send(self, field):
        text = field.text.strip()
        if not text or self._loading:
            return
        self._pending_text = text
        self._retry_count = 0
        self._request_generation += 1
        generation = self._request_generation
        field.text = ""
        if self._empty_state_active:
            self.messages.clear_widgets()
            self._empty_state_active = False
        self._add_message(text, is_user=True, rememberable=True)
        self._set_loading(True)
        from threading import Thread

        Thread(target=self._request_reply, args=(text, generation), daemon=True).start()

    def _set_loading(self, loading: bool):
        self._loading = loading
        self.status.opacity = 1 if loading else 0
        self.status.disabled = not loading
        if loading:
            self.status.pulse()
        else:
            self.status.opacity = 0

    def _request_reply(self, text: str, generation: int):
        try:
            response = self.state.send_message(text)
            Clock.schedule_once(lambda *_: self._finish_reply(response.text, generation), 0)
        except Exception as error:
            Clock.schedule_once(
                lambda *_, caught_error=error, request_generation=generation: self._finish_error(
                    caught_error, request_generation
                ),
                0,
            )

    def _finish_reply(self, text: str, generation: int):
        if generation != self._request_generation:
            return
        self._set_loading(False)
        self._add_message(text, is_user=False)
        self._pending_text = None

    def _finish_error(self, error: Exception | None = None, generation: int | None = None):
        if generation is not None and generation != self._request_generation:
            return
        self._set_loading(False)
        message = _friendly_gateway_error(error or self.state.last_error, self.state.startup_message)
        if self.state.conversation_service is None:
            self.app.notify(message)
            return
        row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(56), spacing=dp(SPACING["xs"]))
        copy = text_label(message, style="body_medium", color=COLORS["error"], text_size=(dp(360), None))
        row.add_widget(copy)
        retry = TBButton(text="Try again", quiet=True, size_hint=(None, None), size=(dp(104), dp(44)))
        retry.bind(on_release=lambda *_: self.send_retry())
        row.add_widget(retry)
        self.messages.add_widget(row)

    def send_retry(self):
        if not self._pending_text:
            return
        if self._retry_count >= 2:
            self.app.notify("Please start a new message and try again later")
            return
        self._retry_count += 1
        self._set_loading(True)
        self._request_generation += 1
        generation = self._request_generation
        from threading import Thread

        Thread(target=self._request_reply, args=(self._pending_text, generation), daemon=True).start()

    def ask_remember(self, text: str):
        dialog = TeddyDialog(
            "Remember this?",
            "Teddy can use this user-approved detail in future conversations. It stays in encrypted local storage, and you can forget it any time.",
            content=text_label(text, style="body_medium", color=COLORS["text"], valign="top", text_size=(dp(360), dp(64))),
            actions=(("Not now", None, "quiet"), ("Remember", lambda: self._remember(text), "primary")),
            height=dp(360),
        )
        dialog.open()

    def _remember(self, text: str):
        if self.state.memory_service is not None:
            try:
                self.state.memory_service.remember(text)
                self.app.notify("Saved to Memory")
            except Exception:
                self.app.notify("Memory couldn't be saved on this device")

    def new_chat(self):
        try:
            self.state.new_conversation()
            self.refresh()
            self._refresh_navigation()
        except Exception:
            self.app.notify("Encrypted conversation storage is unavailable")

    def show_history(self):
        items = self.state.conversations()
        content = BoxLayout(orientation="vertical", spacing=dp(SPACING["xs"]), size_hint_y=None)
        content.bind(minimum_height=content.setter("height"))
        if not items:
            content.add_widget(text_label("No saved conversations yet.", style="body_medium", color=COLORS["muted_text"], size_hint_y=None, height=dp(44)))
        for item in items[:8]:
            row = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(48), spacing=dp(SPACING["micro"]))
            button = TBButton(text=item["title"] or "Conversation", quiet=True, size_hint_x=1, halign="left")
            button.bind(on_release=lambda _, key=item["id"]: self._open_conversation(key))
            rename = TBButton(text="Rename", quiet=True, size_hint=(None, None), width=dp(78), height=dp(44))
            rename.bind(on_release=lambda _, conversation=item: self.rename_conversation(conversation))
            delete = TBButton(text="Delete", destructive=True, size_hint=(None, None), width=dp(72), height=dp(44))
            delete.bind(on_release=lambda _, key=item["id"]: self.delete_conversation(key))
            row.add_widget(button)
            row.add_widget(rename)
            row.add_widget(delete)
            content.add_widget(row)
        dialog = TeddyDialog("Conversation history", "Your conversations are stored in encrypted local storage.", content=content, actions=(("Close", None, "quiet"),), height=min(dp(560), dp(240 + len(items[:8]) * 48)))
        dialog.open()

    def _open_conversation(self, conversation_id: str):
        self.state.open_conversation(conversation_id)
        self.refresh()

    def rename_conversation(self, conversation):
        dialog = TextEntryDialog(
            "Rename conversation",
            "Choose a short name stored only on this device.",
            initial_text=conversation["title"] or "Conversation",
            save_label="Save",
            on_save=lambda title: self._rename_conversation(conversation["id"], title),
        )
        dialog.open()

    def _rename_conversation(self, conversation_id: str, title: str):
        try:
            self.state.rename_conversation(conversation_id, title)
            self.refresh()
            self.show_history()
            self._refresh_navigation()
            self.app.notify("Conversation renamed")
        except Exception:
            self.app.notify("That conversation could not be renamed")

    def delete_conversation(self, conversation_id: str):
        dialog = TeddyDialog(
            "Delete conversation?",
            "This permanently removes the conversation from this device.",
            actions=(("Cancel", None, "quiet"), ("Delete", lambda: self._delete_conversation(conversation_id), "destructive")),
            height=dp(260),
        )
        dialog.open()

    def _delete_conversation(self, conversation_id: str):
        try:
            self.state.delete_conversation(conversation_id)
            self.refresh()
            self._refresh_navigation()
            self.app.notify("Conversation deleted")
        except Exception:
            self.app.notify("That conversation could not be deleted")

    def _refresh_navigation(self):
        shell = getattr(self.app, "shell", None)
        if shell is not None:
            shell._rebuild()


class MemoryScreen(Screen):
    def __init__(self, app, **kwargs):
        super().__init__(**kwargs)
        self.app = app
        self._canvas = AnchorLayout(anchor_x="center", anchor_y="top", size_hint=(1, 1), padding=[dp(SPACING["md"]), dp(SPACING["sm"]), dp(SPACING["md"]), dp(SPACING["sm"])])
        self.root = _vertical_page("Memory", "A small notebook of details you chose to keep.")
        self.root.size_hint = (None, 1)
        self.root.width = _page_width(self.width)
        self.bind(size=self._sync_page_width)
        top_actions = BoxLayout(size_hint_y=None, height=dp(48), spacing=dp(SPACING["xs"]))
        top_actions.add_widget(Widget())
        add_button = TBButton(text="Add memory", primary=True, size_hint=(None, None), size=(dp(144), dp(48)))
        add_button.bind(on_release=lambda *_: self.add_memory())
        top_actions.add_widget(add_button)
        clear_button = TBButton(text="Clear", destructive=True, size_hint=(None, None), size=(dp(80), dp(48)))
        clear_button.bind(on_release=lambda *_: self.clear_memories())
        top_actions.add_widget(clear_button)
        self.root.add_widget(top_actions)
        self.scroll = ScrollView(do_scroll_x=False, bar_width=dp(3))
        self.items = BoxLayout(orientation="vertical", size_hint_y=None, spacing=dp(SPACING["xs"]), padding=[0, dp(SPACING["xs"])])
        self.items.bind(minimum_height=self.items.setter("height"))
        self.scroll.add_widget(self.items)
        self.root.add_widget(self.scroll)
        self._canvas.add_widget(self.root)
        self.add_widget(self._canvas)
        self.bind(on_pre_enter=lambda *_: self.refresh())
        self.refresh()

    def _sync_page_width(self, *_):
        self.root.width = _page_width(self.width)

    def refresh(self):
        self.items.clear_widgets()
        service = self.app.state.memory_service
        memories = service.list() if service is not None else []
        if not memories:
            empty = TBCard(orientation="vertical", size_hint_y=None, height=dp(156), padding=dp(SPACING["xl"]))
            empty.add_widget(text_label("Your notebook is yours to shape.", style="title_medium"))
            empty.add_widget(text_label("Only details you explicitly approve appear here. Add one when something would be useful to remember.", style="body_medium", color=COLORS["muted_text"], valign="top"))
            self.items.add_widget(empty)
            return
        for memory in memories:
            self.items.add_widget(self._memory_card(memory))

    def _memory_card(self, memory):
        card = TBCard(orientation="vertical", size_hint_y=None, height=dp(136), padding=dp(SPACING["md"]), spacing=dp(SPACING["xs"]))
        body = text_label(memory["content"], style="body_large", valign="top", size_hint_y=None)
        body.bind(texture_size=lambda widget, size: self._size_memory_card(card, size[1]))
        card.bind(width=lambda widget, width: setattr(body, "text_size", (max(dp(180), width - dp(SPACING["md"] * 2)), None)))
        card.add_widget(body)
        actions = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(SPACING["xs"]))
        actions.add_widget(Widget())
        edit = TBButton(text="Edit", quiet=True, size_hint=(None, None), width=dp(72))
        edit.bind(on_release=lambda *_: self.edit_memory(memory))
        forget = TBButton(text="Forget", destructive=True, size_hint=(None, None), width=dp(88))
        forget.bind(on_release=lambda *_: self.forget(memory["id"]))
        actions.add_widget(edit)
        actions.add_widget(forget)
        card.add_widget(actions)
        return card

    @staticmethod
    def _size_memory_card(card, body_height):
        card.height = body_height + dp(44 + SPACING["xs"] + SPACING["md"] * 2)

    def add_memory(self):
        dialog = TextEntryDialog(
            "Remember this?",
            "Teddy can use this user-approved detail in future conversations. You can edit or forget it any time.",
            save_label="Remember",
            on_save=self._save_memory,
        )
        dialog.open()

    def edit_memory(self, memory):
        dialog = TextEntryDialog(
            "Edit memory",
            "Change this detail or leave it as it is.",
            initial_text=memory["content"],
            on_save=lambda content: self._update_memory(memory["id"], content),
        )
        dialog.open()

    def _save_memory(self, content: str):
        if self.app.state.memory_service:
            self.app.state.memory_service.remember(content)
            self.refresh()

    def _update_memory(self, memory_id: str, content: str):
        self.app.state.memory_service.update(memory_id, content)
        self.refresh()

    def forget(self, memory_id: str):
        dialog = TeddyDialog("Forget this memory?", "This removes the saved detail from this device.", actions=(("Cancel", None, "quiet"), ("Forget", lambda: self._forget(memory_id), "destructive")), height=dp(260))
        dialog.open()

    def _forget(self, memory_id: str):
        self.app.state.memory_service.forget(memory_id)
        self.refresh()
        self.app.notify("Memory forgotten")

    def clear_memories(self):
        dialog = TeddyDialog(
            "Clear memories?",
            "This removes every saved memory from this device. Conversation history is not affected.",
            actions=(("Cancel", None, "quiet"), ("Clear", self._clear_memories, "destructive")),
            height=dp(280),
        )
        dialog.open()

    def _clear_memories(self):
        self.app.state.clear_memories()
        self.refresh()
        self.app.notify("Memories cleared")


class PrivacyScreen(Screen):
    def __init__(self, app, **kwargs):
        super().__init__(**kwargs)
        self.app = app
        self._canvas = AnchorLayout(anchor_x="center", anchor_y="top", size_hint=(1, 1), padding=[dp(SPACING["md"]), dp(SPACING["sm"]), dp(SPACING["md"]), dp(SPACING["sm"])])
        self.root = _vertical_page("Privacy", "Clear about what stays here and what travels.")
        self.root.size_hint = (None, 1)
        self.root.width = _page_width(self.width)
        self.bind(size=self._sync_page_width)
        scroll = ScrollView(do_scroll_x=False, bar_width=dp(3))
        content = BoxLayout(orientation="vertical", size_hint_y=None, spacing=dp(SPACING["md"]), padding=[0, 0, 0, dp(SPACING["md"])])
        content.bind(minimum_height=content.setter("height"))
        content.add_widget(self._info_panel("Stored on this device", "Conversation history, settings, and memories you approve are kept in an encrypted SQLCipher database. The database key is held by your operating system's secure credential store."))
        content.add_widget(self._info_panel("Sent when you ask for a reply", "Teddy sends your current message and a limited recent conversation context through the Cloudflare gateway to the configured AI model provider. If Memory is enabled, up to three keyword-relevant details you approved may also be included."))
        content.add_widget(self._info_panel("Your controls", "You can turn off memory use, remove individual memories, delete conversation history, or clear local data below. Clearing local data permanently removes the encrypted database and its key."))
        memory_row = TBCard(orientation="horizontal", size_hint_y=None, height=dp(88), padding=dp(SPACING["md"]))
        label = BoxLayout(orientation="vertical", spacing=dp(SPACING["micro"]))
        label.add_widget(text_label("Use approved memories", style="title_small", size_hint_y=None, height=dp(22)))
        label.add_widget(text_label("Relevant details may be included in a reply request.", style="body_small", color=COLORS["muted_text"]))
        memory_row.add_widget(label)
        from teddy_bud.ui.widgets.components import ToggleSwitch

        toggle = ToggleSwitch(active=self.app.state.get_setting("memory_enabled", "true") == "true")
        toggle.bind(active=lambda _, active: self.app.state.set_setting("memory_enabled", "true" if active else "false"))
        memory_row.add_widget(toggle)
        content.add_widget(memory_row)
        content.add_widget(text_label("Data controls", style="title_medium", size_hint_y=None, height=dp(32)))
        delete_conversations = TBButton(text="Delete all conversations", destructive=True)
        delete_conversations.bind(on_release=lambda *_: self._confirm_delete_conversations())
        content.add_widget(delete_conversations)
        clear_data = TBButton(text="Clear all local data", destructive=True)
        clear_data.bind(on_release=lambda *_: self._confirm_clear_data())
        content.add_widget(clear_data)
        scroll.add_widget(content)
        self.root.add_widget(scroll)
        self._canvas.add_widget(self.root)
        self.add_widget(self._canvas)

    def _sync_page_width(self, *_):
        self.root.width = _page_width(self.width)

    @staticmethod
    def _info_panel(title: str, body: str):
        panel = TBCard(orientation="vertical", size_hint_y=None, padding=dp(SPACING["md"]), spacing=dp(SPACING["xs"]))
        panel.add_widget(text_label(title, style="title_medium", size_hint_y=None, height=dp(26)))
        copy = text_label(body, style="body_medium", color=COLORS["muted_text"], valign="top", size_hint_y=None)
        panel.bind(width=lambda widget, width: setattr(copy, "text_size", (max(dp(220), width - dp(SPACING["md"] * 2)), None)))
        copy.bind(texture_size=lambda widget, size: setattr(widget, "height", size[1]))
        panel.add_widget(copy)
        panel.bind(minimum_height=panel.setter("height"))
        return panel

    def _confirm_delete_conversations(self):
        dialog = TeddyDialog("Delete all conversations?", "This permanently removes conversation history from this device. Saved memories are not affected.", actions=(("Cancel", None, "quiet"), ("Delete", self._delete_conversations, "destructive")), height=dp(280))
        dialog.open()

    def _delete_conversations(self):
        self.app.state.clear_conversations()
        self.app.chat_screen.refresh()
        self.app.notify("Conversations deleted")

    def _confirm_clear_data(self):
        dialog = TeddyDialog("Clear all local data?", "This permanently removes conversations, memories, settings, and the encrypted database key from this device.", actions=(("Cancel", None, "quiet"), ("Clear data", self._clear_data, "destructive")), height=dp(280))
        dialog.open()

    def _clear_data(self):
        self.app.state.clear_local_data()
        self.app.notify("Local data cleared")
        self.app.chat_screen.refresh()
        self.app.memory_screen.refresh()


class SettingsScreen(Screen):
    def __init__(self, app, **kwargs):
        super().__init__(**kwargs)
        self.app = app
        self._canvas = AnchorLayout(anchor_x="center", anchor_y="top", size_hint=(1, 1), padding=[dp(SPACING["md"]), dp(SPACING["sm"]), dp(SPACING["md"]), dp(SPACING["sm"])])
        self.root = _vertical_page("Settings", "Make Teddy Bud feel right for you.")
        self.root.size_hint = (None, 1)
        self.root.width = _page_width(self.width)
        self.bind(size=self._sync_page_width)
        scroll = ScrollView(do_scroll_x=False, bar_width=dp(3))
        self.content = BoxLayout(orientation="vertical", size_hint_y=None, spacing=dp(SPACING["md"]), padding=[0, 0, 0, dp(SPACING["md"])])
        self.content.bind(minimum_height=self.content.setter("height"))
        self._build_content()
        scroll.add_widget(self.content)
        self.root.add_widget(scroll)
        self._canvas.add_widget(self.root)
        self.add_widget(self._canvas)

    def _sync_page_width(self, *_):
        self.root.width = _page_width(self.width)

    def _build_content(self):
        self.content.clear_widgets()
        self.content.add_widget(text_label("Conversation", style="title_medium", size_hint_y=None, height=dp(32)))
        self.content.add_widget(self._response_style())
        self.content.add_widget(self._toggle_row("Enter to send", "Press Enter to send a message.", "enter_to_send", "true"))
        self.content.add_widget(self._toggle_row("Show timestamps", "Show a small time under each message.", "show_timestamps", "false"))
        self.content.add_widget(text_label("Memory", style="title_medium", size_hint_y=None, height=dp(32)))
        self.content.add_widget(self._toggle_row("Memory enabled", "Approved relevant details can help personalize replies.", "memory_enabled", "true"))
        memory_button = TBButton(text="View and edit memories", quiet=True)
        memory_button.bind(on_release=lambda *_: self.app.open_page("memory"))
        self.content.add_widget(memory_button)
        self.content.add_widget(text_label("Appearance", style="title_medium", size_hint_y=None, height=dp(32)))
        self.content.add_widget(self._choice_row("Text size", "text_size", ("Standard", "Large"), ("standard", "large")))
        self.content.add_widget(self._info_row("Theme", "Warm light"))
        self.content.add_widget(text_label("About", style="title_medium", size_hint_y=None, height=dp(32)))
        self.content.add_widget(self._info_row("Teddy Bud", "A calm space for conversation"))
        self.content.add_widget(self._info_row("AI processing", "Cloudflare gateway - NVIDIA-hosted models"))
        privacy = TBButton(text="Privacy and data controls", quiet=True)
        privacy.bind(on_release=lambda *_: self.app.open_page("privacy"))
        self.content.add_widget(privacy)

    def _toggle_row(self, title, subtitle, key, default):
        from teddy_bud.ui.widgets.components import SettingRow

        active = self.app.state.get_setting(key, default) == "true"
        return SettingRow(title, subtitle, active=active, on_change=lambda value: self._save_toggle(key, value))

    def _save_toggle(self, key, value):
        self.app.state.set_setting(key, "true" if value else "false")
        if key == "enter_to_send":
            self.app.chat_screen.composer.set_enter_to_send(value)

    def _response_style(self):
        panel = TBCard(orientation="vertical", size_hint_y=None, height=dp(104), padding=dp(SPACING["md"]), spacing=dp(SPACING["xs"]))
        panel.add_widget(text_label("Response style", style="title_small", size_hint_y=None, height=dp(22)))
        panel.add_widget(text_label("Choose how Teddy shapes a reply.", style="body_small", color=COLORS["muted_text"], size_hint_y=None, height=dp(18)))
        panel.add_widget(self._choice_row("", "response_style", ("Balanced", "Brief", "Reflective"), ("balanced", "brief", "reflective"), compact=True))
        return panel

    def _choice_row(self, label, key, titles, values, compact=False):
        row = BoxLayout(orientation="horizontal", size_hint=(1, None), height=dp(48 if compact else 60), spacing=dp(SPACING["xs"]))
        if label:
            label_widget = text_label(label, style="title_small", size_hint_x=None)
            label_widget.bind(texture_size=lambda widget, size: setattr(widget, "width", max(dp(80), size[0])))
            row.add_widget(label_widget)
        current = self.app.state.get_setting(key, values[0])
        for title, value in zip(titles, values):
            button = TBButton(
                text=title,
                selected=current == value,
                quiet=current != value,
                size_hint=(1, None),
                height=dp(44),
                font_size=sp(TYPE_SCALE["label_medium"][0]),
                padding=[dp(SPACING["xs"]), dp(SPACING["xs"])] if compact else [dp(SPACING["md"]), dp(SPACING["xs"])],
            )
            button.bind(on_release=lambda _, selected=value: self._choose(key, selected))
            row.add_widget(button)
        return row

    def _choose(self, key, value):
        self.app.state.set_setting(key, value)
        if key == "text_size":
            from teddy_bud.ui.widgets.components import set_text_scale

            set_text_scale(1.15 if value == "large" else 1.0, self.app.manager)
        self._build_content()

    @staticmethod
    def _info_row(title, value):
        panel = TBCard(orientation="horizontal", size_hint_y=None, height=dp(60), padding=dp(SPACING["md"]))
        panel.add_widget(text_label(title, style="title_small"))
        panel.add_widget(Widget())
        panel.add_widget(text_label(value, style="body_small", color=COLORS["muted_text"]))
        return panel

    def on_pre_enter(self, *_):
        self._build_content()
