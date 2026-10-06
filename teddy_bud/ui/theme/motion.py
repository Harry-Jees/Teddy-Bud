"""Centralized motion and animation tokens for Teddy Bud.

Restrained, organic motion principles aligned with DESIGN.MD:
- Short durations (120ms - 400ms)
- Eased curves (out_quad, out_cubic)
- Smooth opacity fades without conflicting with layout managers
- Micro-interactions on buttons and toggles
"""

from __future__ import annotations

from kivy.animation import Animation
from kivy.metrics import dp


DURATIONS = {
    "micro": 0.12,
    "fast": 0.18,
    "normal": 0.25,
    "slow": 0.40,
}

EASINGS = {
    "standard": "out_quad",
    "decelerate": "out_cubic",
    "accelerate": "in_quad",
}


def animate_entrance(widget, *, duration: float = DURATIONS["fast"], on_complete=None) -> None:
    """Animate a widget into view with a smooth layout-safe fade-in."""
    widget.opacity = 0.0
    anim = Animation(opacity=1.0, d=duration, t=EASINGS["decelerate"])
    if on_complete:
        anim.bind(on_complete=lambda *_: on_complete())
    anim.start(widget)


def animate_press(widget, *, duration: float = DURATIONS["micro"]) -> None:
    """Brief touch press response for interactive elements."""
    anim = Animation(opacity=0.85, d=duration, t="out_quad") + Animation(opacity=1.0, d=duration, t="in_quad")
    anim.start(widget)


def animate_modal(modal, *, duration: float = DURATIONS["fast"]) -> None:
    """Smooth fade-in for dialog overlays."""
    modal.opacity = 0.0
    anim = Animation(opacity=1.0, d=duration, t=EASINGS["decelerate"])
    anim.start(modal)
