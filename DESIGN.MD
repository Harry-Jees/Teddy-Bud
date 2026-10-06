# Teddy Bud — Complete UI & Design System

> **Version:** 1.0
> **Product:** Teddy Bud
> **Platform:** Python / Kivy / KivyMD
> **Design direction:** Warm Premium Clay × Material 3
> **Theme:** Light
> **Primary experience:** Emotional companion chat
> **Design priority:** Calm → Warm → Trustworthy → Private → Premium → Simple

---

# 1. Design North Star

Teddy Bud must **not look like a generic AI chatbot**.

It should feel like a quiet, personal space where a user can naturally talk.

The visual language is:

> **Cream background + Cocoa primary + Clay surfaces + soft elevation + warm typography + generous spacing + restrained motion.**

The interface must communicate:

* warmth
* safety
* privacy
* simplicity
* companionship
* technical reliability
* emotional calm

It must **not** communicate:

* corporate dashboard
* generic ChatGPT clone
* futuristic neon AI
* cyberpunk
* excessive glassmorphism
* childish cartoon UI
* clinical mental-health software
* social-media feed

---

# 2. Design Principles

## 2.1 Warm, not childish

The UI may be friendly but must remain mature and premium.

Use:

* warm cream
* cocoa
* clay
* soft peach
* organic rounded surfaces

Avoid:

* excessive hearts
* excessive emojis
* cartoon decorations
* childish gradients
* bright primary colors

---

## 2.2 Calm, not empty

The interface should have breathing room.

Do not fill empty space with unnecessary cards, illustrations, statistics, or features.

---

## 2.3 Private, not secretive

Privacy should be obvious and understandable.

The user should easily find:

* what is stored
* what is sent to the gateway/model
* what memory means
* how to delete memory
* how to delete conversations
* how to clear local data

Never make privacy controls intentionally difficult to discover.

---

## 2.4 Emotional, not manipulative

Teddy Bud can feel warm without pretending to be human.

Allowed:

> Teddy is thinking…

> Remember this?

> You can change this anytime.

Avoid:

> Teddy missed you.

> Teddy was waiting for you.

> Teddy is lonely without you.

Avoid fake online status, fake presence, or deliberately artificial typing delays designed to imitate a human.

---

# 3. Design Foundation

KivyMD should use Material 3-compatible component behavior and theming where practical. KivyMD provides Material 3 support and theme management.

However, Teddy Bud's visual identity overrides generic Material defaults where necessary.

Material behavior:

**YES**

Material visual identity:

**NO**

Teddy Bud's custom visual system is:

**Cream × Cocoa × Clay**

---

# 4. Color System

## 4.1 Brand Colors

| Token       | Hex       | Purpose                     |
| ----------- | --------- | --------------------------- |
| `cream-50`  | `#FFF8F0` | Main application background |
| `cream-100` | `#FFFCF8` | Elevated surfaces           |
| `cocoa-700` | `#8B5E3C` | Primary brand/action        |
| `clay-200`  | `#F3D6C0` | Secondary/selected surfaces |
| `clay-400`  | `#B97850` | Secondary accent            |
| `peach-300` | `#E9A978` | Decorative highlight        |
| `ink-900`   | `#2C2520` | Primary text                |
| `taupe-600` | `#7D7067` | Secondary text              |
| `divider`   | `#E7DCD2` | Dividers/borders            |

These are the canonical Teddy Bud colors.

Do not invent random colors.

---

# 5. Semantic Colors

| State       | Hex       |
| ----------- | --------- |
| Success     | `#527A5A` |
| Warning     | `#A66A2C` |
| Error       | `#A84D45` |
| Information | `#5E7180` |

Semantic colors are for states only.

They must not become additional brand colors.

Color must never be the only way a state is communicated.

---

# 6. Accessibility

Target WCAG 2.2 AA principles.

Normal body text should target:

**4.5:1 minimum contrast**

Large text:

**3:1 minimum**

Meaningful UI components and graphical indicators:

**3:1 minimum against adjacent colors**.

Keyboard focus must remain clearly visible. WCAG 2.2 also defines stronger guidance for focus appearance, including sufficient size and a 3:1 change-of-contrast threshold.

For Teddy Bud:

```text
Focus indicator:
2dp minimum visible perimeter
2dp offset where practical
minimum 3:1 contrast change
```

Never remove focus indicators for aesthetic reasons.

Focused elements must not be hidden behind persistent navigation or other author-created UI.

---

# 7. Typography

## 7.1 Primary Typeface

**Plus Jakarta Sans**

Use for:

* body
* chat
* buttons
* navigation
* settings
* metadata
* labels

## 7.2 Display Typeface

**Fraunces**

Use sparingly for:

* welcome heading
* large emotional statements
* major empty states

Never use Fraunces for dense body text.

---

# 8. Type Scale

| Token             | Size | Weight | Line Height |
| ----------------- | ---: | -----: | ----------: |
| `display-large`   | 40sp |    600 |        48sp |
| `display-medium`  | 32sp |    600 |        40sp |
| `headline-large`  | 28sp |    600 |        36sp |
| `headline-medium` | 24sp |    600 |        32sp |
| `title-large`     | 22sp |    600 |        28sp |
| `title-medium`    | 18sp |    600 |        24sp |
| `body-large`      | 16sp |    400 |        24sp |
| `body-medium`     | 14sp |    400 |        20sp |
| `body-small`      | 12sp |    400 |        16sp |
| `label-large`     | 14sp |    600 |        20sp |
| `label-medium`    | 12sp |    600 |        16sp |
| `label-small`     | 11sp |    600 |        16sp |

Primary conversation text:

**16sp / 24sp**

Do not reduce normal chat text below `15sp`.

---

# 9. Spacing System

Use an 8dp base grid.

| Token      | Value |
| ---------- | ----: |
| `space-1`  |   4dp |
| `space-2`  |   8dp |
| `space-3`  |  12dp |
| `space-4`  |  16dp |
| `space-5`  |  20dp |
| `space-6`  |  24dp |
| `space-8`  |  32dp |
| `space-10` |  40dp |
| `space-12` |  48dp |
| `space-16` |  64dp |
| `space-20` |  80dp |

Primary spacing values:

**8 / 16 / 24 / 32dp**

Do not introduce arbitrary values unless technically required by Kivy layout behavior.

---

# 10. Corner Radius System

| Token          | Value |
| -------------- | ----: |
| `radius-sm`    |  12dp |
| `radius-md`    |  18dp |
| `radius-lg`    |  20dp |
| `radius-xl`    |  28dp |
| `radius-round` |   50% |

Use only these values.

---

# 11. Touch Targets

Minimum:

**44 × 44dp**

Preferred:

**48 × 48dp**

The visible icon can be smaller, but the interactive container must remain at least 44dp.

Recommended:

```text
icon: 20–24dp
touch target: 44–48dp
```

---

# 12. Iconography

Use a consistent Lucide-style outline icon language.

Default:

**24dp**

Compact:

**20dp**

Large action:

**28dp**

Stroke:

approximately **2dp**

Do not randomly mix:

* filled icons
* outlined icons
* emoji
* different icon families

A single interface should have one coherent icon language.

---

# 13. Elevation

Teddy Bud uses **soft claymorphism**, not heavy shadows.

Standard surface:

```text
background: #FFFCF8
radius: 20dp
shadow Y: 2dp
shadow blur: 8–12dp
shadow opacity: 6–10%
```

Do not use black shadows at high opacity.

If spacing/background contrast can separate components, prefer that instead of a shadow.

---

# 14. Application Background

Main background:

```text
#FFF8F0
```

Never use pure `#FFFFFF` as the entire app background.

This is the visual foundation of the Teddy Bud identity.

---

# 15. Application Shell

Teddy Bud is **chat-first**.

The application should open directly into the conversation experience.

Do not create a dashboard as the default home screen.

Primary areas:

1. Chat
2. Memory
3. Privacy
4. Settings

Maximum primary navigation destinations:

**4**

---

# 16. Phone Baseline

Design against:

**390 × 844dp**

Standard horizontal margin:

**16dp**

Content width:

```text
390 - 16 - 16 = 358dp
```

For widths below `360dp`:

```text
horizontal margin = 12dp
```

---

# 17. Tablet/Desktop

For widths:

`≥ 600dp`

Center the primary content.

Conversation maximum:

**720dp**

For widths:

`≥ 1200dp`

Maximum app shell:

**1120dp**

The conversation column must remain approximately:

**720dp maximum**

Never stretch chat bubbles across an entire desktop display.

---

# 18. Chat Screen

## 18.1 Header

Height:

**64dp**

Horizontal padding:

**16dp**

Structure:

```text
┌──────────────────────────────────────┐
│ [Avatar]  Teddy Bud           [•••] │
│           Your private companion     │
└──────────────────────────────────────┘
```

Avatar:

**40 × 40dp**

Avatar radius:

**20dp**

Title:

**16sp / 600**

Subtitle:

**12sp / 400**

Subtitle color:

`#7D7067`

Do not show fake online status.

---

# 19. Message Area

Background:

`#FFF8F0`

Horizontal padding:

**16dp**

Normal message gap:

**8dp**

Grouped message gap:

**4dp**

The newest message should remain near the bottom.

---

# 20. User Message Bubble

Background:

`#8B5E3C`

Text:

`#FFFCF8`

Maximum width:

**78%**

Radius:

**20dp**

Grouped bottom corner:

**6dp**

Padding:

```text
horizontal: 16dp
vertical: 11dp
```

Text:

**16sp / 24sp**

---

# 21. Teddy Message Bubble

Background:

`#F3D6C0`

Text:

`#2C2520`

Maximum width:

**82%**

Radius:

**20dp**

Padding:

```text
horizontal: 16dp
vertical: 11dp
```

Text:

**16sp / 24sp**

---

# 22. Message Timestamps

Default:

**hidden**

If enabled:

```text
size: 11sp
color: #7D7067
spacing: 4dp
```

Do not display timestamps on every message by default.

---

# 23. Message Grouping

Consecutive messages from the same speaker should visually belong together.

Example:

```text
        Teddy
   ┌───────────────────┐
   │ First message     │
   └───────────────────┘
   ┌───────────────────┐
   │ Second message    │
   └───────────────────┘

User
                    ┌───────────────┐
                    │ Response      │
                    └───────────────┘
```

Avoid excessive repeated avatars.

---

# 24. Composer

Persistent bottom composer.

Outer margin:

```text
left: 16dp
right: 16dp
top: 12dp
bottom: 12dp
```

Background:

`#FFFCF8`

Radius:

**24dp**

Minimum height:

**52dp**

Maximum height:

**128dp**

Padding:

**6dp**

---

# 25. Composer Input

Font:

**16sp / 24sp**

Placeholder:

> Talk to Teddy…

Placeholder color:

`#7D7067`

No animated placeholder.

Focus state:

* visible focus border
* no large glow
* no dramatic scale

---

# 26. Send Button

Size:

**40 × 40dp**

Touch container:

minimum **44 × 44dp**

Radius:

**20dp**

Background:

`#8B5E3C`

Icon:

Lucide Send

Icon:

**20dp**

Disabled state:

use muted surface.

---

# 27. Thinking State

Text:

> Teddy is thinking…

Use three subtle animated dots.

Animation:

```text
duration: 1200ms
scale: 0.85 → 1.00
opacity: 0.45 → 1.00
```

Do not fake long human typing delays.

If the backend takes longer than approximately:

**8 seconds**

show a calm retry/help state.

---

# 28. Empty Chat

First-launch state:

```text
        [ Teddy ]
           ↓

     Hi, I'm Teddy.

You can talk to me about
whatever is on your mind.

       [ Start talking ]
```

Illustration:

**96 × 96dp**

Top breathing space:

**80dp**

Spacing:

```text
avatar → heading: 24dp
heading → body: 12dp
body → CTA: 24dp
```

Heading:

Fraunces

**32sp / 600**

Body:

Plus Jakarta Sans

**16sp / 24sp**

---

# 29. Primary Button

Background:

`#8B5E3C`

Text:

`#FFFCF8`

Height:

**48dp**

Radius:

**18dp**

Horizontal padding:

**20dp**

Icon gap:

**8dp**

Label:

**14sp / 600**

Pressed animation:

```text
scale: 0.98
duration: 90ms
```

No bounce.

---

# 30. Secondary Button

Background:

`#F3D6C0`

Text:

`#2C2520`

Height:

**48dp**

Radius:

**18dp**

Use for secondary actions.

---

# 31. Tertiary Button

Transparent background.

Text:

`#8B5E3C`

No filled container.

Use for low-priority actions.

---

# 32. Navigation

Recommended phone navigation:

```text
┌────────────────────────────────────┐
│                                    │
│              CONTENT               │
│                                    │
├────────────────────────────────────┤
│ Chat   Memory   Privacy   Settings │
└────────────────────────────────────┘
```

Navigation height:

**80dp**

Icon:

**24dp**

Label:

**12sp**

Selected indicator:

approximately:

**64 × 32dp**

Selected background:

`#F3D6C0`

Selected content:

`#8B5E3C`

Unselected:

`#7D7067`

---

# 33. Privacy

Privacy is a first-class product feature.

Primary privacy card:

```text
background: #FFFCF8
radius: 20dp
padding: 20–24dp
```

Heading:

**24sp / 600**

Body:

**14–16sp / 24sp**

Suggested copy:

> Your conversations are yours.

Then clearly explain:

* local storage
* cloud processing
* memory
* deletion
* data controls

Never claim a conversation is completely local if it is sent to the gateway/model.

---

# 34. Memory

Memory screen should feel like a personal notebook, not an admin database.

Memory card:

```text
minimum height: 64dp
radius: 18dp
padding: 16dp
```

Structure:

```text
[icon]  Favorite music
        You enjoy listening to...      [•••]
```

Actions:

* Edit
* Forget
* Delete

Destructive:

`#A84D45`

---

# 35. Memory Consent

When Teddy wants to save information:

```text
Remember this?

Teddy can use this in future
conversations.

[ Not now ]       [ Remember ]
```

Never use manipulative wording.

The user must remain in control.

---

# 36. Settings

Sections:

## Conversation

* Response style
* Message timestamps
* Enter to send

## Memory

* Memory enabled
* View memories
* Clear memories

## Privacy

* Data controls
* Delete conversations
* Clear local data

## Appearance

* Theme
* Text size

## About

* Version
* Privacy information
* Technology information

---

# 37. Dialogs

Maximum width:

**360dp**

Radius:

**28dp**

Background:

`#FFFCF8`

Padding:

**24dp**

Title:

**24sp / 32sp / 600**

Body:

**16sp / 24sp**

Action gap:

**8dp**

Maximum primary actions:

**2**

---

# 38. Delete Dialog

Example:

> Delete this conversation?

> This cannot be undone.

Actions:

```text
Cancel
Delete
```

Delete:

`#A84D45`

Never disguise destructive actions.

---

# 39. Snackbar

Height:

**48dp**

Radius:

**14dp**

Horizontal margin:

**16dp**

Bottom spacing:

**16dp**

Use for:

* Saved
* Copied
* Memory forgotten
* Connection restored

Do not use snackbar for critical privacy decisions.

---

# 40. Error States

Never expose raw technical errors as the primary UI.

Bad:

```text
HTTP 400
```

Good:

> Teddy couldn't respond right now.

Secondary:

> Check your connection and try again.

CTA:

**Try again**

Developer diagnostics can contain technical information separately.

---

# 41. Network States

Distinguish:

```text
OFFLINE
GATEWAY_UNAVAILABLE
MODEL_UNAVAILABLE
AUTH_EXPIRED
UNKNOWN_ERROR
```

Do not translate every failure into:

> No internet connection.

Offline state:

> You're offline. Your local conversations are still available.

---

# 42. Authentication Failure

Never display:

```text
JWT invalid
DEVICE_KEYS lookup failed
Ed25519 verification failed
```

User-facing:

> Teddy couldn't securely connect right now.

Developer/debug screen may contain technical diagnostics.

Never expose:

* JWT
* private keys
* public keys unnecessarily
* authorization headers
* NVIDIA keys
* DEVICE_KEYS
* gateway secrets

---

# 43. Motion

Motion is functional.

It must communicate:

* entering
* leaving
* sending
* receiving
* loading
* state change

It must not exist merely because animation is possible.

---

# 44. Motion Durations

| Action                     | Duration |
| -------------------------- | -------: |
| Press                      |     90ms |
| Small state                |    150ms |
| Component enter            |    220ms |
| Dialog                     |    240ms |
| Screen transition          |    280ms |
| Large emotional transition |    350ms |

Preferred easing:

```text
enter = ease-out
exit = ease-in
standard = ease-in-out
```

Avoid default bounce.

---

# 45. Message Animation

Teddy message:

```text
opacity: 0 → 1
Y: 8dp → 0
duration: 180ms
```

User message:

```text
opacity: 0 → 1
Y: 4dp → 0
duration: 140ms
```

Never animate the entire conversation when one message arrives.

---

# 46. Scroll Behavior

If user is already near the bottom:

**automatically follow new messages**

If user has scrolled upward:

**do not force-scroll**

Instead show:

> ↓ New message

Control:

**44 × 44dp**

This prevents users from losing their reading position.

---

# 47. Long Responses

Maximum readable desktop message width:

approximately:

**680dp**

Paragraph gap:

**12dp**

List item gap:

**8dp**

Code blocks, if supported:

```text
radius: 12dp
horizontal scrolling: enabled
monospace font
separate surface
```

Never force huge code blocks into normal conversational bubbles.

---

# 48. Responsive Rules

## `<360dp`

```text
margin: 12dp
user bubble: 84%
Teddy bubble: 86%
```

## `360–599dp`

```text
margin: 16dp
user bubble: 78%
Teddy bubble: 82%
```

## `600–767dp`

```text
content max-width: 600dp
centered
```

## `≥768dp`

```text
conversation max-width: 720dp
centered
```

## `≥1200dp`

```text
app shell max-width: 1120dp
conversation max-width: 720dp
```

---

# 49. Teddy Avatar

Default:

**40 × 40dp**

Large:

**96 × 96dp**

Shape:

**circle**

Visual characteristics:

* warm
* soft
* minimal
* friendly
* premium
* non-photorealistic
* non-uncanny

The avatar must never dominate the chat.

---

# 50. Component Inventory

Create/reuse these standardized components:

```text
TeddyAppBar
TeddyAvatar
TeddyMessageBubble
UserMessageBubble
MessageGroup
MessageComposer
ThinkingIndicator
EmptyChatState
PrivacyCard
MemoryCard
MemoryConsentDialog
TeddyButton
TeddyIconButton
TeddyCard
TeddyDialog
TeddySnackbar
TeddyBottomNavigation
TeddySettingsRow
TeddySectionHeader
TeddyErrorState
TeddyOfflineBanner
```

Do not create another component if an existing component can handle the same role.

---

# 51. Design Token Architecture

All UI values should come from tokens.

Recommended namespaces:

```text
color.*
type.*
space.*
radius.*
elevation.*
motion.*
size.*
state.*
```

Example:

```text
color.background.primary = #FFF8F0
color.surface.primary = #FFFCF8
color.brand.primary = #8B5E3C
color.brand.soft = #F3D6C0
color.text.primary = #2C2520
color.text.secondary = #7D7067

radius.sm = 12dp
radius.md = 18dp
radius.lg = 20dp
radius.xl = 28dp

space.1 = 4dp
space.2 = 8dp
space.3 = 12dp
space.4 = 16dp
space.5 = 20dp
space.6 = 24dp
space.8 = 32dp
```

---

# 52. Do Not Hardcode Arbitrary UI Values

Bad:

```python
padding = 13
radius = 17
font_size = 15
```

Preferred:

```python
padding = dp(16)
radius = dp(20)
font_size = sp(16)
```

or centralized design tokens.

Every visual value must have a reason.

---

# 53. Visual Density

Target:

**comfortable / medium**

The application must not look like:

* an enterprise dashboard
* a settings-heavy utility
* a social-media feed

The conversation should occupy approximately:

**70–80%**

of usable phone screen height once conversation is active.

---

# 54. Borders

Default:

```text
1dp
#E7DCD2
```

Do not outline every card.

Borders should primarily be used for:

* inputs
* focus
* selection
* controls that require explicit separation

---

# 55. Shadows

Recommended:

```text
Y: 2–4dp
blur: 8–16dp
opacity: 6–12%
```

Use sparingly.

Avoid strong black shadows.

---

# 56. Primary Action Hierarchy

Every screen should have one visually dominant action.

Hierarchy:

```text
Primary      #8B5E3C
Secondary    #F3D6C0
Tertiary     transparent
Destructive  #A84D45
```

Do not put multiple large primary buttons next to each other.

---

# 57. Accessibility Checklist

Every screen:

* [ ] text is scalable
* [ ] body text remains readable
* [ ] interactive controls are ≥44dp
* [ ] icons have accessible meaning
* [ ] focus is visible
* [ ] focused elements are not hidden
* [ ] color is not the only state indicator
* [ ] important UI contrast is at least 3:1
* [ ] normal text targets 4.5:1
* [ ] destructive actions are clearly labeled

---

# 58. Emotional UX Checklist

Every screen should answer:

> Does this make Teddy Bud feel calm?

> Does this make Teddy Bud feel personal?

> Does this make Teddy Bud feel trustworthy?

> Does this reduce cognitive load?

> Does this respect the user's autonomy?

If not, simplify it.

---

# 59. Anti-Patterns

Never introduce:

* neon purple AI gradients
* cyberpunk visuals
* excessive glassmorphism
* giant gradients
* random rounded rectangles
* inconsistent radii
* excessive colors
* excessive emojis
* fake online status
* fake human typing
* tiny text
* hidden privacy controls
* aggressive animations
* full-screen spinners for normal chat
* giant mascot artwork
* dashboard cards unrelated to conversation
* unnecessary technical model information in the main UI

---

# 60. First-Launch Experience

Maximum:

**3 screens**

Recommended:

### Screen 1

**Hi, I'm Teddy.**

Short introduction.

### Screen 2

**Your privacy matters.**

Explain local/cloud processing accurately.

### Screen 3

**Ready when you are.**

CTA:

**Start talking**

No forced feature tour.

---

# 61. Privacy Messaging Principle

Never oversimplify technical privacy into a misleading claim.

If a message is sent through:

```text
Teddy Bud
↓
Cloudflare Worker
↓
NVIDIA/model provider
```

the UI must not say:

> Everything stays on your device.

Instead clearly distinguish:

* local storage
* gateway processing
* model processing
* memory storage

---

# 62. Product Personality

Teddy Bud's visual personality:

```text
Warm       ██████████
Calm       ██████████
Premium    █████████
Playful    █████
Technical  █████
Clinical   ██
Corporate  ██
```

The product should feel emotionally intelligent without becoming childish or manipulative.

---

# 63. Implementation Order

## Phase 1 — Design Foundation

1. Color tokens
2. Typography
3. Spacing
4. Radius
5. Elevation
6. Icon system

## Phase 2 — Chat

1. App bar
2. Message bubbles
3. Grouping
4. Composer
5. Thinking state
6. Error state
7. Offline state

## Phase 3 — Trust

1. Privacy card
2. Memory UI
3. Memory consent
4. Delete flows
5. Security/network states

## Phase 4 — Navigation

1. Bottom navigation
2. Memory
3. Privacy
4. Settings

## Phase 5 — Polish

1. Motion
2. Responsive layout
3. Accessibility
4. Performance
5. Visual QA

---

# 64. Final Design Rule

Before adding any UI element, the developer must answer:

### 1. Which design token controls this?

### 2. Can an existing Teddy Bud component be reused?

### 3. Does it improve the user's experience?

### 4. Does it preserve privacy clarity?

### 5. Does it belong to the Cream × Cocoa × Clay system?

If the answer is no, do not add the element without a documented reason.

---

# 65. Design Definition

Teddy Bud is:

> **A warm, private-feeling conversational space built around emotional clarity rather than visual complexity.**

Its visual identity is:

> **Cream background → Cocoa actions → Clay surfaces → Warm typography → Soft elevation → Generous spacing → Calm motion.**

The interface should disappear behind the conversation.

The user should remember **how Teddy Bud felt**, not how many UI components it contained.

---

# 66. Reference Standards

The implementation should use the following external standards/references:

* Material Design 3 / KivyMD Material 3 component principles.
* WCAG 2.2 text/non-text contrast guidance.
* WCAG 2.2 visible-focus and focus-appearance guidance.
* WCAG 2.2 focus-not-obscured guidance.

These references establish the accessibility/interaction baseline; the Teddy Bud color, spacing, typography, emotional UX, and visual language are product-specific decisions defined by this document.
