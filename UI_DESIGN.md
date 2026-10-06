# Teddy Bud UI direction

The UI uses a warm, calm, private visual language: cream background, cocoa
primary actions, clay selected surfaces, Plus Jakarta Sans for interface text,
and Fraunces for display moments. Colors, typography, spacing, radii, and
touch-target values are centralized in `teddy_bud/ui/theme/tokens.py`.

## Screen responsibilities

- Onboarding explains the companion experience, local encrypted storage, and
  gateway processing without making absolute security claims.
- Chat is the primary surface for bubbles, multiline composition, loading,
  failed sends, bounded retry, history, and conversation controls.
- Memory shows only active saved memories and supports add, edit, forget, and
  clear-all actions.
- Privacy explains what stays on-device, what may leave the device, and the
  available deletion controls.
- Settings contains response style, composer, timestamps, memory, appearance,
  and about controls.

## Accessibility and responsive behavior

Controls target at least 44dp where practical and use centralized text styles.
The text-size preference updates the current interface immediately. The
adaptive shell uses a bottom navigation layout on compact windows and a sidebar
on desktop windows. Content width is bounded on wide displays and contracts on
narrow windows; long message and memory text wraps inside scrollable surfaces.

Visual smoke tests cover app construction, theme transition colors, and toggle
interaction. Device-level Android and Windows visual verification remains a
release task.
