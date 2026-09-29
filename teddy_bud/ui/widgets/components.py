from __future__ import annotations

from kivy.graphics import Color, RoundedRectangle
from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput

from teddy_bud.ui.theme.tokens import COLORS, RADII, SPACING


def _rgb(hex_color: str):
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))


class TBCard(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(padding=dp(SPACING["md"]), spacing=dp(SPACING["sm"]), **kwargs)
        with self.canvas.before:
            Color(*_rgb(COLORS["surface"]), 1)
            self._background = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(RADII["card"])])
        self.bind(pos=self._refresh_background, size=self._refresh_background)

    def _refresh_background(self, *_):
        self._background.pos = self.pos
        self._background.size = self.size


class TBButton(Button):
    def __init__(self, *, primary: bool = False, **kwargs):
        kwargs.setdefault("font_size", dp(14))
        kwargs.setdefault("color", _rgb(COLORS["surface"]) if primary else _rgb(COLORS["primary"]))
        kwargs.setdefault("background_normal", "")
        kwargs.setdefault("background_down", "")
        super().__init__(**kwargs)
        fill = COLORS["primary"] if primary else COLORS["primary_container"]
        with self.canvas.before:
            Color(*_rgb(fill), 1)
            self._background = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(RADII["button"])])
        self.bind(pos=self._refresh_background, size=self._refresh_background)

    def _refresh_background(self, *_):
        self._background.pos = self.pos
        self._background.size = self.size


class TBSectionHeader(Label):
    def __init__(self, **kwargs):
        kwargs.setdefault("color", _rgb(COLORS["text"]))
        kwargs.setdefault("font_size", dp(20))
        kwargs.setdefault("bold", True)
        kwargs.setdefault("halign", "left")
        kwargs.setdefault("text_size", (None, None))
        super().__init__(**kwargs)


class TBChatBubble(TBCard):
    def __init__(self, text: str, *, is_user: bool = False, **kwargs):
        super().__init__(orientation="vertical", size_hint_y=None, **kwargs)
        self.padding = dp(SPACING["sm"])
        self.size_hint_x = 0.86
        self.pos_hint = {"right": 1} if is_user else {"x": 0}
        self.add_widget(Label(text=text, color=_rgb(COLORS["surface"] if is_user else COLORS["text"]), font_size=dp(16), halign="left", valign="middle", size_hint_y=None))
        self._message = self.children[0]
        self._message.bind(texture_size=self._resize)
        self._bubble_fill = COLORS["primary"] if is_user else COLORS["surface"]
        with self.canvas.before:
            Color(*_rgb(self._bubble_fill), 1)
            self._background = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(RADII["card"])])
        self.bind(pos=self._refresh_bubble, size=self._refresh_bubble)

    def _resize(self, *_):
        self.height = self._message.texture_size[1] + dp(SPACING["sm"] * 2)

    def _refresh_bubble(self, *_):
        self._background.pos = self.pos
        self._background.size = self.size


class TBMessageInput(BoxLayout):
    def __init__(self, on_send, **kwargs):
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", dp(56))
        super().__init__(orientation="horizontal", spacing=dp(SPACING["xs"]), **kwargs)
        self.field = TextInput(hint_text="Write something...", multiline=False, font_size=dp(16), foreground_color=_rgb(COLORS["text"]), background_color=_rgb(COLORS["surface"]), padding=[dp(16), dp(16)])
        self.add_widget(self.field)
        send = TBButton(text="Send", primary=True, size_hint_x=None, width=dp(88))
        send.bind(on_release=lambda *_: on_send(self.field))
        self.field.bind(on_text_validate=lambda *_: on_send(self.field))
        self.add_widget(send)


class TBLoadingIndicator(Label):
    def __init__(self, **kwargs):
        kwargs.setdefault("text", "Teddy is thinking...")
        kwargs.setdefault("color", _rgb(COLORS["muted_text"]))
        kwargs.setdefault("font_size", dp(14))
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", dp(32))
        super().__init__(**kwargs)

