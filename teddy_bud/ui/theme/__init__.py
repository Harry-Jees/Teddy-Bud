from pathlib import Path

from kivy.core.text import LabelBase

from .tokens import COLORS, SPACING, RADII, TYPE_SCALE
from .motion import DURATIONS, EASINGS, animate_entrance, animate_press, animate_modal


def register_fonts() -> None:
	font_dir = Path(__file__).with_name("..").resolve() / "fonts"
	LabelBase.register(name="Plus Jakarta Sans", fn_regular=str(font_dir / "PlusJakartaSans.ttf"))
	LabelBase.register(name="Fraunces", fn_regular=str(font_dir / "Fraunces.ttf"))


__all__ = [
	"COLORS",
	"SPACING",
	"RADII",
	"TYPE_SCALE",
	"DURATIONS",
	"EASINGS",
	"animate_entrance",
	"animate_press",
	"animate_modal",
	"register_fonts",
]

