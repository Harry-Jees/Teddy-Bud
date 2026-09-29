from teddy_bud.ui.theme.tokens import COLORS, RADII, SPACING


def test_locked_colors_are_present():
    assert COLORS["background"] == "#FFF8F0"
    assert COLORS["primary"] == "#8B5E3C"
    assert COLORS["surface"] == "#FFFCF8"


def test_spacing_and_radii_follow_specification():
    assert set(SPACING.values()) == {8, 16, 24, 32, 40, 48, 64}
    assert RADII["card"] == 20
    assert RADII["button"] == 16

