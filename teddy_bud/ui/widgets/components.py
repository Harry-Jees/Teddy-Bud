from __future__ import annotations

import os

from kivy.animation import Animation
from kivy.graphics import Color, Ellipse, Line, RoundedRectangle
from kivy.metrics import dp, sp
from kivy.properties import BooleanProperty
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.image import Image
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.widget import Widget

from teddy_bud.ui.theme.tokens import COLORS, FONT_PRIMARY, RADII, SPACING, TYPE_SCALE


_TEXT_SCALE = 1.0


def _rgb(hex_color: str):
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))


def get_text_scale() -> float:
    return _TEXT_SCALE


def set_text_scale(scale: float, root: Widget | None = None) -> None:
    global _TEXT_SCALE
    _TEXT_SCALE = scale
    if root is not None:
        pending = [root]
        while pending:
            widget = pending.pop()
            base_size = getattr(widget, "_tb_base_font_size", None)
            if base_size is not None:
                widget.font_size = base_size * scale
            pending.extend(widget.children)


def text_label(text: str, *, style: str = "body_medium", color: str | None = None, **kwargs) -> Label:
    size, weight = TYPE_SCALE[style]
    kwargs.setdefault("font_size", sp(size) * _TEXT_SCALE)
    kwargs.setdefault("bold", weight >= 600)
    kwargs.setdefault("color", _rgb(color or COLORS["text"]))
    kwargs.setdefault("font_name", FONT_PRIMARY)
    kwargs.setdefault("halign", "left")
    kwargs.setdefault("valign", "middle")
    label = Label(text=text, **kwargs)
    label._tb_base_font_size = label.font_size / _TEXT_SCALE
    return label


class Surface(BoxLayout):
    def __init__(self, *, fill: str | None = None, radius: str = "card", outlined: bool = False, **kwargs):
        kwargs.setdefault("padding", dp(SPACING["md"]))
        kwargs.setdefault("spacing", dp(SPACING["sm"]))
        super().__init__(**kwargs)
        self.fill = fill or COLORS["surface"]
        self.radius = dp(RADII[radius])
        with self.canvas.before:
            Color(*_rgb(self.fill), 1)
            self._background = RoundedRectangle(pos=self.pos, size=self.size, radius=[self.radius])
        if outlined:
            with self.canvas.after:
                Color(*_rgb(COLORS["divider"]), 1)
                self._outline = Line(rounded_rectangle=(self.x, self.y, self.width, self.height, self.radius), width=1)
        else:
            self._outline = None
        self.bind(pos=self._sync_canvas, size=self._sync_canvas)

    def _sync_canvas(self, *_):
        self._background.pos = self.pos
        self._background.size = self.size
        if self._outline is not None:
            self._outline.rounded_rectangle = (self.x, self.y, self.width, self.height, self.radius)


class TBCard(Surface):
    pass


class TBButton(Button):
    def __init__(self, *, primary: bool = False, destructive: bool = False, quiet: bool = False, selected: bool = False, **kwargs):
        kwargs.setdefault("font_size", sp(TYPE_SCALE["label_large"][0]) * _TEXT_SCALE)
        kwargs.setdefault("bold", True)
        kwargs.setdefault("font_name", FONT_PRIMARY)
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", dp(48))
        kwargs.setdefault("padding", [dp(SPACING["md"]), dp(SPACING["xs"])])
        kwargs.setdefault("background_normal", "")
        kwargs.setdefault("background_down", "")
        kwargs.setdefault("background_color", (0, 0, 0, 0))
        if primary or destructive:
            foreground = COLORS["surface"]
        elif selected:
            foreground = COLORS["primary"]
        elif destructive:
            foreground = COLORS["error"]
        else:
            foreground = COLORS["muted_text"] if quiet else COLORS["text"]
        kwargs.setdefault("color", _rgb(foreground))
        super().__init__(**kwargs)
        self._tb_base_font_size = self.font_size / _TEXT_SCALE
        self.primary = primary
        self.destructive = destructive
        self.quiet = quiet
        self.selected = selected
        self._set_colors()
        with self.canvas.before:
            self._fill_color = Color(0, 0, 0, 0)
            self._background = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(RADII["button"])])
        self.bind(pos=self._sync_canvas, size=self._sync_canvas, state=self._update_fill)
        self._update_fill()

    def _set_colors(self):
        if self.primary:
            self.fill = COLORS["primary"]
        elif self.destructive:
            self.fill = COLORS["error"]
        elif self.selected:
            self.fill = COLORS["primary_container"]
        elif self.quiet:
            self.fill = COLORS["background"]
        else:
            self.fill = COLORS["surface"]

    def _update_fill(self, *_):
        self._fill_color.rgba = (*_rgb(COLORS["divider"] if self.state == "down" else self.fill), 1)

    def _sync_canvas(self, *_):
        self._background.pos = self.pos
        self._background.size = self.size


class TeddyAvatar(Widget):
    def __init__(self, *, size_dp: int = 40, **kwargs):
        kwargs.setdefault("size_hint", (None, None))
        kwargs.setdefault("size", (dp(size_dp), dp(size_dp)))
        super().__init__(**kwargs)
        logo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "logo.png"))
        self._fallback = False
        if os.path.exists(logo_path):
            self._logo = Image(source=logo_path, allow_stretch=True, keep_ratio=True)
            self._logo.size = self.size
            self._logo.pos = self.pos
            self.add_widget(self._logo)
        else:
            self._fallback = True
            with self.canvas:
                Color(*_rgb(COLORS["primary_container"]), 1)
                self._base = Ellipse(pos=self.pos, size=self.size)
                Color(*_rgb(COLORS["accent"]), 1)
                self._cheek = Ellipse()
                Color(*_rgb(COLORS["primary"]), 1)
                self._eye_left = Ellipse()
                self._eye_right = Ellipse()
        self.bind(pos=self._sync, size=self._sync)

    def _sync(self, *_):
        if not self._fallback and hasattr(self, "_logo"):
            self._logo.pos = self.pos
            self._logo.size = self.size
            return
        self._base.pos, self._base.size = self.pos, self.size
        self._cheek.pos = (self.x + self.width * 0.55, self.y + self.height * 0.56)
        self._cheek.size = (self.width * 0.44, self.height * 0.44)
        eye_size = self.width * 0.09
        self._eye_left.pos = (self.x + self.width * 0.35, self.y + self.height * 0.56)
        self._eye_right.pos = (self.x + self.width * 0.56, self.y + self.height * 0.56)
        self._eye_left.size = self._eye_right.size = (eye_size, eye_size)


class TBSectionHeader(Label):
    def __init__(self, **kwargs):
        kwargs.setdefault("color", _rgb(COLORS["text"]))
        kwargs.setdefault("font_size", sp(TYPE_SCALE["headline_medium"][0]) * _TEXT_SCALE)
        kwargs.setdefault("font_name", FONT_PRIMARY)
        kwargs.setdefault("bold", True)
        kwargs.setdefault("halign", "left")
        kwargs.setdefault("valign", "middle")
        kwargs.setdefault("text_size", (None, None))
        super().__init__(**kwargs)
        self._tb_base_font_size = self.font_size / _TEXT_SCALE


class TBChatBubble(Surface):
    def __init__(self, text: str, *, is_user: bool = False, show_remember: bool = False, on_remember=None, **kwargs):
        kwargs.setdefault("orientation", "vertical")
        kwargs.setdefault("size_hint", (None, None))
        kwargs.setdefault("padding", [dp(SPACING["md"]), dp(11), dp(SPACING["md"]), dp(11)])
        kwargs.setdefault("spacing", dp(SPACING["micro"]))
        kwargs.setdefault("fill", COLORS["primary"] if is_user else COLORS["primary_container"])
        kwargs.setdefault("radius", "card")
        super().__init__(**kwargs)
        self.is_user = is_user
        self._content = text_label(
            text,
            style="body_large",
            color=COLORS["surface"] if is_user else COLORS["text"],
            size_hint=(1, None),
            text_size=(None, None),
            valign="top",
        )
        self.add_widget(self._content)
        self._content.bind(texture_size=self._resize)
        if show_remember and on_remember is not None:
            remember = TBButton(text="Remember", quiet=True, size_hint_x=None, width=dp(112), height=dp(44))
            remember.bind(on_release=lambda *_: on_remember(text))
            self.add_widget(remember)
        self.bind(size=self._measure)
        self._measure()

    def _measure(self, *_):
        self._content.text_size = (max(dp(80), self.width - dp(SPACING["md"] * 2)), None)

    def _resize(self, *_):
        extra = dp(44) + dp(SPACING["micro"]) if len(self.children) > 1 else 0
        self.height = self._content.texture_size[1] + dp(SPACING["md"]) + dp(11) + extra


class TBMessageInput(BoxLayout):
    def __init__(self, on_send, *, enter_to_send: bool = True, **kwargs):
        self._on_send = on_send
        self.enter_to_send = False
        kwargs.setdefault("orientation", "horizontal")
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", dp(64))
        kwargs.setdefault("padding", [dp(SPACING["xs"]), dp(SPACING["xs"])])
        kwargs.setdefault("spacing", dp(SPACING["xs"]))
        super().__init__(**kwargs)
        with self.canvas.before:
            Color(*_rgb(COLORS["surface"]), 1)
            self._background = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(RADII["surface"])])
            Color(*_rgb(COLORS["primary"]), 1)
            self._outline = Line(rounded_rectangle=(self.x, self.y, self.width, self.height, dp(RADII["surface"])), width=1.5)
        self.bind(pos=self._sync_canvas, size=self._sync_canvas)
        self.field = TextInput(
            hint_text="Talk to Teddy...",
            multiline=not enter_to_send,
            font_size=sp(TYPE_SCALE["body_large"][0]) * _TEXT_SCALE,
            font_name=FONT_PRIMARY,
            foreground_color=_rgb(COLORS["text"]),
            hint_text_color=_rgb(COLORS["muted_text"]),
            cursor_color=_rgb(COLORS["primary"]),
            selection_color=(*_rgb(COLORS["primary_container"]), 0.8),
            background_normal="",
            background_active="",
            background_color=(0, 0, 0, 0),
            padding=[dp(SPACING["sm"]), dp(SPACING["xs"])],
        )
        self.field._tb_base_font_size = self.field.font_size / _TEXT_SCALE
        self.add_widget(self.field)
        self.send_button = TBButton(text="Send", primary=True, size_hint=(None, None), size=(dp(76), dp(48)))
        self.add_widget(self.send_button)
        self.send_button.bind(on_release=self._send)
        self.field.bind(text=self._resize_for_text)
        self.set_enter_to_send(enter_to_send)

    def _send(self, *_):
        self._on_send(self.field)

    def _send_on_enter(self, *_):
        self._send()

    def set_enter_to_send(self, enabled: bool) -> None:
        if self.enter_to_send == enabled:
            return
        self.enter_to_send = enabled
        self.field.multiline = not enabled
        if enabled:
            self.field.bind(on_text_validate=self._send_on_enter)
        else:
            self.field.unbind(on_text_validate=self._send_on_enter)

    def _sync_canvas(self, *_):
        self._background.pos = self.pos
        self._background.size = self.size
        self._outline.rounded_rectangle = (self.x, self.y, self.width, self.height, dp(RADII["surface"]))

    def _resize_for_text(self, *_):
        lines = min(4, max(1, self.field.text.count("\n") + 1))
        self.height = min(dp(128), max(dp(64), dp(48 + lines * 24)))


class SettingRow(BoxLayout):
    def __init__(self, title: str, subtitle: str = "", *, active: bool = False, on_change=None, **kwargs):
        kwargs.setdefault("orientation", "horizontal")
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", dp(72 if subtitle else 60))
        kwargs.setdefault("spacing", dp(SPACING["md"]))
        super().__init__(**kwargs)
        text_stack = BoxLayout(orientation="vertical", spacing=dp(SPACING["micro"]))
        text_stack.add_widget(text_label(title, style="title_small", size_hint_y=None, height=dp(22)))
        if subtitle:
            text_stack.add_widget(text_label(subtitle, style="body_small", color=COLORS["muted_text"], valign="top"))
        self.add_widget(text_stack)
        self.control = ToggleSwitch(active=active)
        if on_change:
            self.control.bind(active=lambda _, value: on_change(value))
        self.add_widget(self.control)


class ToggleSwitch(Widget):
    active = BooleanProperty(False)

    def __init__(self, **kwargs):
        kwargs.setdefault("size_hint", (None, None))
        kwargs.setdefault("size", (dp(52), dp(44)))
        super().__init__(**kwargs)
        self.accessible_name = "Setting toggle"
        self._pressed = False
        with self.canvas:
            self._track_color = Color(0, 0, 0, 1)
            self._track = RoundedRectangle(radius=[dp(12)])
            Color(*_rgb(COLORS["surface"]), 1)
            self._thumb = Ellipse()
        self.bind(pos=self._sync, size=self._sync, active=self._sync, disabled=self._sync)
        self._sync()

    def on_touch_down(self, touch):
        if self.disabled or not self.collide_point(*touch.pos):
            return super().on_touch_down(touch)
        self._pressed = True
        self._sync()
        return True

    def on_touch_up(self, touch):
        if not self._pressed:
            return super().on_touch_up(touch)
        self._pressed = False
        if self.collide_point(*touch.pos):
            self.active = not self.active
        self._sync()
        return True

    def on_release(self):
        if not self.disabled:
            self.active = not self.active

    def _sync(self, *_):
        if self.disabled:
            track = COLORS["divider"]
        else:
            track = COLORS["primary"] if self.active else COLORS["divider"]
        self._track_color.rgba = (*_rgb(track), 1)
        self._track.pos = (self.x + dp(5), self.center_y - dp(12))
        self._track.size = (dp(42), dp(24))
        thumb_size = dp(20)
        thumb_x = self.x + (dp(26) if self.active else dp(8))
        self._thumb.pos = (thumb_x, self.center_y - thumb_size / 2)
        self._thumb.size = (thumb_size, thumb_size)


class NavButton(TBButton):
    def __init__(self, label: str, glyph: str, *, selected: bool = False, desktop: bool = False, **kwargs):
        text = f"{glyph}    {label}" if desktop and glyph else (f"{glyph}\n{label}" if glyph else label)
        kwargs.setdefault("text", text)
        kwargs.setdefault("selected", selected)
        kwargs.setdefault("quiet", not selected)
        kwargs.setdefault("height", dp(52 if desktop else 64))
        kwargs.setdefault("font_size", sp(TYPE_SCALE["label_medium"][0]))
        kwargs.setdefault("halign", "left" if desktop else "center")
        super().__init__(**kwargs)
        self.desktop = desktop


class TBLoadingIndicator(Label):
    def __init__(self, **kwargs):
        kwargs.setdefault("text", "Putting a reply together")
        kwargs.setdefault("color", _rgb(COLORS["muted_text"]))
        kwargs.setdefault("font_size", sp(TYPE_SCALE["body_medium"][0]) * _TEXT_SCALE)
        kwargs.setdefault("font_name", FONT_PRIMARY)
        kwargs.setdefault("size_hint_y", None)
        kwargs.setdefault("height", dp(32))
        super().__init__(**kwargs)
        self._tb_base_font_size = self.font_size / _TEXT_SCALE

    def pulse(self):
        self.stop_pulse()
        self.opacity = 1
        self._anim = Animation(opacity=0.55, d=0.6, t="out_quad") + Animation(opacity=1, d=0.6, t="in_quad")
        self._anim.repeat = True
        self._anim.start(self)

    def stop_pulse(self):
        if getattr(self, "_anim", None) is not None:
            self._anim.cancel(self)
            self._anim = None
        self.opacity = 0
