# Teddy Bud design system

Teddy Bud uses a warm, calm **Material-inspired claymorphism** visual language. Claymorphism is an expressive surface treatment, not a substitute for clear hierarchy, contrast, focus, or component boundaries.

## Foundations

- **Spacing:** an 8pt rhythm: 8, 16, 24, 32, 40, 48, 64. A 4pt micro-step is reserved for optical alignment and icon details.
- **Shape:** 8, 12, 16 and 24px corner families. Use larger radii for panels and smaller radii for nested controls.
- **Typography:** rounded display/heading styles; readable system body text. Body copy should generally be 14–16px, supporting labels 12px or larger.
- **Surfaces:** warm ivory canvas, paper surfaces and soft clay containers. Use a fine border plus a restrained warm shadow to retain the tactile clay effect; never rely on shadow alone to communicate an edge or state.
- **Motion:** short, purposeful feedback. Respect `prefers-reduced-motion` and the in-app reduced-motion preference.

## Colour roles

| Role | Token | Value |
|---|---|---|
| Canvas | `canvas` | `#FFFAF1` |
| Surface | `surface` | `#FFFCF7` |
| Soft surface | `surfaceAlt` | `#F1E6DA` |
| Main text | `text` | `#302821` |
| Secondary text | `textSecondary` | `#6F6256` |
| Primary action | `primary` | `#75513D` |
| Primary container | `primaryContainer` | `#F0E1D4` |
| Accent text | `accentText` | `#87533F` |
| Success | `success` | `#4F684D` |
| Warning | `warning` | `#76552F` |
| Error | `danger` | `#8D473F` |
| Border | `border` | `#D8C8B8` |

Use semantic roles consistently. Do not use a pale clay shade for small text; reserve lighter peach/clay colours for fills, illustration, and decorative accents.

## Contrast spot-checks

Ratios are calculated from the defined sRGB tokens using the WCAG relative-luminance formula.

| Foreground / background | Contrast |
|---|---:|
| Main text on canvas | 13.92:1 |
| Main text on paper | 14.14:1 |
| Secondary text on canvas | 5.68:1 |
| Secondary text on paper | 5.77:1 |
| Primary text/action on paper | 6.84:1 |
| On-primary-container on primary container | 8.56:1 |
| Accent text on paper | 6.14:1 |
| Success on success container | 5.24:1 |
| Error on error container | 5.76:1 |
| Light clay text on primary surface | 5.60:1 |

Target WCAG 2.2 AA: 4.5:1 for normal text and 3:1 for large text and essential non-text controls. Contrast must be checked against the actual surface a component uses, not only the page canvas.

## Components and interaction

- Prefer 48dp touch targets on Android; never make a primary action smaller than 44pt on Apple platforms.
- Keep at least 8dp between adjacent touch targets.
- Every interactive control needs visible hover/pressed, focus, disabled, loading and error states where applicable.
- Focus must remain visible; colour alone must not communicate selection or status.
- Repeated controls should share the same typography, height, padding, radius, border and state treatment.
- Preserve the warm clay look with soft raised surfaces, but keep text crisp and controls obvious.

## Implementation

- React Native tokens: `client/src/theme.ts`.
- Web equivalents: CSS custom properties in `client/web.css`.
- Shared screen components should import the token module instead of adding new literal colours or spacing values.
