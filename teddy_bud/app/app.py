from __future__ import annotations

from kivy.app import App
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.screenmanager import Screen, ScreenManager, SlideTransition
from kivy.uix.scrollview import ScrollView
from threading import Thread

from teddy_bud.app.state import AppState
from teddy_bud.config.settings import load_settings
from teddy_bud.ui.theme.tokens import COLORS
from teddy_bud.ui.widgets.components import TBButton, TBCard, TBChatBubble, TBLoadingIndicator, TBMessageInput, TBSectionHeader, _rgb


class OnboardingScreen(Screen):
    def __init__(self, manager: ScreenManager, **kwargs):
        super().__init__(**kwargs)
        layout = BoxLayout(orientation="vertical", padding=dp(32), spacing=dp(24))
        layout.add_widget(Label(text="Teddy Bud", color=_rgb(COLORS["primary"]), font_size=dp(32), bold=True, size_hint_y=None, height=dp(48)))
        layout.add_widget(Label(text="A friendly space to talk, whenever you need it.", color=_rgb(COLORS["text"]), font_size=dp(20), halign="left"))
        privacy = TBCard(orientation="vertical", size_hint_y=None, height=dp(148))
        privacy.add_widget(Label(text="Private by design", color=_rgb(COLORS["text"]), font_size=dp(18), bold=True))
        privacy.add_widget(Label(text="Conversations stay on your device. AI requests use only the context needed for the moment.", color=_rgb(COLORS["muted_text"]), font_size=dp(14), halign="left"))
        layout.add_widget(privacy)
        layout.add_widget(Label())
        start = TBButton(text="Start talking", primary=True, size_hint_y=None, height=dp(52))
        start.bind(on_release=lambda *_: setattr(manager, "current", "chat"))
        layout.add_widget(start)
        self.add_widget(layout)


class ChatScreen(Screen):
    def __init__(self, state: AppState, **kwargs):
        super().__init__(**kwargs)
        self.state = state
        root = BoxLayout(orientation="vertical", padding=dp(24), spacing=dp(16))
        root.add_widget(TBSectionHeader(text="Chat", size_hint_y=None, height=dp(32)))
        self.scroll = ScrollView(do_scroll_x=False)
        self.messages = BoxLayout(orientation="vertical", spacing=dp(12), size_hint=(None, None), padding=[0, dp(8)], pos_hint={"center_x": 0.5})
        self.messages.bind(minimum_height=self.messages.setter("height"))
        Window.bind(size=self._adapt_width)
        self._adapt_width()
        self.scroll.add_widget(self.messages)
        root.add_widget(self.scroll)
        self.status = TBLoadingIndicator(opacity=0, disabled=True)
        root.add_widget(self.status)
        root.add_widget(TBMessageInput(self._send, size_hint_y=None))
        self.add_widget(root)
        self._add_message("Hi, I’m Teddy Bud. What’s on your mind?", is_user=False)
        if state.startup_message:
            self._add_message(state.startup_message, is_user=False)

    def _adapt_width(self, *_):
        self.messages.width = min(dp(720), max(dp(280), Window.width - dp(48)))

    def _add_message(self, text: str, *, is_user: bool):
        self.messages.add_widget(TBChatBubble(text, is_user=is_user))
        Clock.schedule_once(lambda *_: setattr(self.scroll, "scroll_y", 0), 0)

    def _send(self, field):
        text = field.text.strip()
        if not text:
            return
        field.text = ""
        self._add_message(text, is_user=True)
        self.status.opacity = 1
        self.status.disabled = False
        self._set_loading(True)
        Thread(target=self._request_reply, args=(text,), daemon=True).start()

    def _set_loading(self, loading: bool):
        self.status.opacity = 1 if loading else 0
        self.status.disabled = not loading

    def _request_reply(self, text: str):
        try:
            response = self.state.send_message(text)
            Clock.schedule_once(lambda *_: self._finish_reply(response.text), 0)
        except Exception:
            Clock.schedule_once(lambda *_: self._finish_reply("I’m having trouble reaching my conversation service right now. Try again in a moment."), 0)

    def _finish_reply(self, text: str):
        self._set_loading(False)
        self._add_message(text, is_user=False)


class ContentScreen(Screen):
    def __init__(self, title: str, body: str, **kwargs):
        super().__init__(**kwargs)
        layout = BoxLayout(orientation="vertical", padding=dp(24), spacing=dp(16))
        layout.add_widget(TBSectionHeader(text=title, size_hint_y=None, height=dp(32)))
        card = TBCard(orientation="vertical", size_hint_y=None, height=dp(132))
        card.add_widget(Label(text=body, color=_rgb(COLORS["text"]), halign="left", valign="middle"))
        layout.add_widget(card)
        layout.add_widget(Label())
        self.add_widget(layout)


class TeddyBudApp(App):
    title = "Teddy Bud"

    def build(self):
        self.settings = load_settings()
        self.state = AppState(self.settings)
        self.state.initialize()
        Window.clearcolor = _rgb(COLORS["background"]) + (1,)
        manager = ScreenManager(transition=SlideTransition(duration=0.22))
        manager.add_widget(OnboardingScreen(manager, name="onboarding"))
        manager.add_widget(ChatScreen(self.state, name="chat"))
        manager.add_widget(ContentScreen("Memories", "Your saved memories will live here, under your control.", name="memories"))
        manager.add_widget(ContentScreen("Profile & Settings", "Private, local preferences for your Teddy Bud experience.", name="profile"))
        root = BoxLayout(orientation="vertical")
        root.add_widget(manager)
        nav = BoxLayout(size_hint_y=None, height=dp(64), padding=dp(8), spacing=dp(8))
        for label, target in (("Chat", "chat"), ("Memories", "memories"), ("Profile", "profile")):
            button = TBButton(text=label, primary=target == "chat")
            button.bind(on_release=lambda _, screen=target: self._go_to(manager, screen))
            nav.add_widget(button)
        root.add_widget(nav)
        return root

    @staticmethod
    def _go_to(manager: ScreenManager, screen: str):
        manager.current = screen
