from __future__ import annotations

import os

from kivy.app import App
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.metrics import dp
from kivy.utils import platform
from kivy.uix.anchorlayout import AnchorLayout
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.screenmanager import FadeTransition, ScreenManager
from kivy.uix.widget import Widget

from teddy_bud.app.state import AppState
from teddy_bud.config.settings import load_settings
from teddy_bud.ui.screens import ChatScreen, MemoryScreen, OnboardingScreen, PrivacyScreen, SettingsScreen
from teddy_bud.ui.theme import register_fonts
from teddy_bud.ui.theme.tokens import COLORS, LAYOUT, RADII, SPACING
from teddy_bud.ui.widgets.components import NavButton, TBButton, TBCard, TeddyAvatar, text_label, set_text_scale, _rgb


NAV_ITEMS = (
    ("chat", "Chat", ""),
    ("memory", "Memory", ""),
    ("privacy", "Privacy", ""),
    ("settings", "Settings", ""),
)


class AdaptiveShell(BoxLayout):
    def __init__(self, app, manager, **kwargs):
        kwargs.setdefault("orientation", "horizontal")
        super().__init__(**kwargs)
        self.app = app
        self.manager = manager
        self._desktop = None
        self._onboarding = manager.current == "onboarding"
        self.bind(size=self._adapt)
        self.manager.bind(current=self._page_changed)
        self._rebuild()

    def _page_changed(self, _, current):
        self._onboarding = current == "onboarding"
        self._rebuild()

    def _adapt(self, *_):
        desktop = self.width >= dp(880)
        if desktop != self._desktop:
            self._desktop = desktop
            self._rebuild()

    def _rebuild(self):
        if not hasattr(self, "manager"):
            return
        if self.manager.parent is not None:
            self.manager.parent.remove_widget(self.manager)
        self.clear_widgets()

        desktop = self.width >= dp(880)
        show_navigation = not self._onboarding
        self.orientation = "horizontal" if show_navigation and desktop else "vertical"
        self.size_hint = (1, 1)

        content = BoxLayout(orientation="vertical", spacing=0, size_hint=(1, 1))
        self.manager.size_hint = (1, 1)
        content.add_widget(self.manager)

        if show_navigation and not desktop:
            mobile_nav = self._mobile_navigation()
            mobile_nav.size_hint = (1, None)
            content.add_widget(mobile_nav)

        if show_navigation and desktop:
            sidebar = self._desktop_sidebar()
            sidebar.size_hint = (None, 1)
            sidebar.width = dp(244)
            self.add_widget(sidebar)
            content.size_hint_x = 1
            self.add_widget(content)
        else:
            self.add_widget(content)

    def _mobile_navigation(self):
        bar = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(80), padding=[dp(SPACING["xs"]), dp(SPACING["xs"])], spacing=dp(SPACING["micro"]))
        for screen, label, glyph in NAV_ITEMS:
            button = NavButton(label, glyph, selected=self.manager.current == screen, desktop=False, size_hint_x=1)
            button.bind(on_release=lambda _, target=screen: self.app.open_page(target))
            bar.add_widget(button)
        return bar

    def _desktop_sidebar(self):
        sidebar = BoxLayout(orientation="vertical", size_hint_x=None, width=dp(244), padding=[dp(SPACING["md"]), dp(SPACING["md"])], spacing=dp(SPACING["xs"]))
        with sidebar.canvas.before:
            from kivy.graphics import Color, Rectangle

            Color(*_rgb(COLORS["surface"]), 1)
            sidebar._surface = Rectangle(pos=sidebar.pos, size=sidebar.size)
        sidebar.bind(pos=lambda widget, _: setattr(widget._surface, "pos", widget.pos), size=lambda widget, _: setattr(widget._surface, "size", widget.size))
        brand = BoxLayout(orientation="horizontal", size_hint_y=None, height=dp(56), spacing=dp(SPACING["xs"]))
        brand.add_widget(TeddyAvatar())
        brand.add_widget(text_label("Teddy Bud", style="title_medium"))
        sidebar.add_widget(brand)
        new_chat = TBButton(text="＋   New conversation", primary=True, size_hint_y=None, height=dp(48))
        new_chat.bind(on_release=lambda *_: self._new_conversation())
        sidebar.add_widget(new_chat)
        for screen, label, glyph in NAV_ITEMS:
            button = NavButton(label, glyph, selected=self.manager.current == screen, desktop=True)
            button.size_hint_x = 1
            button.bind(on_release=lambda _, target=screen: self.app.open_page(target))
            sidebar.add_widget(button)
        sidebar.add_widget(Widget(size_hint_y=None, height=dp(SPACING["xs"])))
        sidebar.add_widget(text_label("RECENT", style="label_small", color=COLORS["muted_text"], size_hint_y=None, height=dp(28)))
        recent_scroll = __import__("kivy.uix.scrollview", fromlist=["ScrollView"]).ScrollView(do_scroll_x=False, bar_width=dp(2))
        recent = BoxLayout(orientation="vertical", size_hint_y=None, spacing=dp(SPACING["micro"]))
        recent.bind(minimum_height=recent.setter("height"))
        for conversation in self.app.state.conversations()[:8]:
            item = TBButton(text=conversation["title"] or "Conversation", quiet=True, size_hint_y=None, height=dp(44), halign="left", font_size=dp(12))
            item.bind(on_release=lambda _, key=conversation["id"]: self._open_conversation(key))
            recent.add_widget(item)
        if not recent.children:
            recent.add_widget(text_label("Your conversations will appear here.", style="body_small", color=COLORS["muted_text"], size_hint_y=None, height=dp(48), text_size=(dp(196), None)))
        recent_scroll.add_widget(recent)
        sidebar.add_widget(recent_scroll)
        sidebar.add_widget(Widget())
        sidebar.add_widget(text_label("Private by design. Clear in practice.", style="body_small", color=COLORS["muted_text"], size_hint_y=None, height=dp(40), text_size=(dp(200), None)))
        return sidebar

    def _new_conversation(self):
        try:
            self.app.state.new_conversation()
            self.app.open_page("chat")
            self.app.chat_screen.refresh()
        except Exception:
            self.app.notify("Encrypted conversation storage is unavailable")

    def _open_conversation(self, conversation_id: str):
        try:
            self.app.state.open_conversation(conversation_id)
            self.app.open_page("chat")
            self.app.chat_screen.refresh()
        except Exception:
            self.app.notify("That conversation is no longer available")


class TeddyBudApp(App):
    title = "Teddy Bud"

    def build(self):
        register_fonts()
        # Preserve injected settings/state used by tests and embedding hosts.
        # A rebuild must not silently switch to the user's default database.
        if not hasattr(self, "settings"):
            self.settings = load_settings()
        if not hasattr(self, "state"):
            self.state = AppState(self.settings)
        self.state.initialize()
        set_text_scale(1.15 if self.state.get_setting("text_size", "standard") == "large" else 1.0)
        Window.clearcolor = (*_rgb(COLORS["background"]), 1)
        Window.softinput_mode = "below_target"
        if platform in {"win", "linux", "macosx"} and Window.width < dp(1000):
            Window.size = (dp(1280), dp(840))

        manager = ScreenManager(
            transition=FadeTransition(
                duration=0.18,
                clearcolor=(*_rgb(COLORS["background"]), 1),
            )
        )
        if os.path.exists(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logo.png"))):
            Window.set_icon(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logo.png")))
        manager.add_widget(OnboardingScreen(self, name="onboarding"))
        self.chat_screen = ChatScreen(self, name="chat")
        self.memory_screen = MemoryScreen(self, name="memory")
        self.privacy_screen = PrivacyScreen(self, name="privacy")
        self.settings_screen = SettingsScreen(self, name="settings")
        for screen in (self.chat_screen, self.memory_screen, self.privacy_screen, self.settings_screen):
            manager.add_widget(screen)
        self.manager = manager
        initial_page = "chat" if self.state.get_setting("onboarding_complete", "false") == "true" else "onboarding"
        manager.current = initial_page

        anchor = AnchorLayout(anchor_x="center", anchor_y="center")
        shell = AdaptiveShell(self, manager, size_hint=(None, None))
        shell.width = min(Window.width, dp(LAYOUT["shell_max"]))
        shell.height = Window.height
        Window.bind(size=lambda _, size: self._resize_shell(shell, size))
        anchor.add_widget(shell)
        self.shell = shell
        return anchor

    @staticmethod
    def _resize_shell(shell, size):
        shell.width = min(size[0], dp(LAYOUT["shell_max"]))
        shell.height = size[1]

    def open_page(self, page: str):
        self.manager.current = page
        if page == "memory":
            self.memory_screen.refresh()
        elif page == "settings":
            self.settings_screen._build_content()

    def notify(self, message: str):
        if not hasattr(self, "shell"):
            return
        if hasattr(self, "_toast") and self._toast.parent is not None:
            self._toast.parent.remove_widget(self._toast)
        from kivy.uix.modalview import ModalView

        toast = ModalView(size_hint=(None, None), size=(max(dp(1), min(dp(420), Window.width - dp(32))), dp(56)), background="", background_color=(0, 0, 0, 0), overlay_color=(0, 0, 0, 0), auto_dismiss=True)
        toast.pos_hint = {"center_x": 0.5, "y": 0.03}
        card = TBCard(padding=[dp(SPACING["md"]), dp(SPACING["xs"])], radius="small")
        card.add_widget(text_label(message, style="body_medium"))
        toast.add_widget(card)
        toast.open()
        self._toast = toast
        Clock.schedule_once(lambda *_: toast.dismiss(), 2.8)
