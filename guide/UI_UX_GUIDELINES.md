# UI & UX Design System

## 1. Design North Star
**Theme:** Light (Warm Premium Clay × Material 3)
**Core Vibe:** Calm → Warm → Trustworthy → Private → Premium → Simple

The interface must communicate warmth and safety. It must explicitly avoid generic "AI", neon, glassmorphism, or clinical dashboard aesthetics. It must remain mature and premium, avoiding childish designs (no excessive hearts or cartoon emojis).

## 2. Visual Language
- **Colors**:
  - Background: Warm Cream
  - Primary Actions: Cocoa
  - Surfaces: Clay (organic rounded corners)
  - Accents: Soft peach
  - *Avoid*: Pure black, cold grays, random color palettes, harsh shadows.
- **Typography**:
  - Interface/Body: `Plus Jakarta Sans`
  - Display/Headers: `Fraunces`
- **Sizing**: Controls target at least 44dp where practical for accessibility.

## 3. Responsive Layouts
- **Compact/Mobile (Android)**: Bottom navigation bar.
- **Wide/Desktop (Windows)**: Left sidebar navigation.
- Long messages must cleanly wrap; content width must be bounded on large screens to maintain readability and avoid stretching.

## 4. Core Screens
1. **Onboarding**: Explains companionship, local encryption, and privacy clearly.
2. **Chat**: Chat bubbles, multiline composer, loading indicators, retry bounds.
3. **Memory**: Clean list of active memories with edit/delete functions.
4. **Privacy & Settings**: Plain-English toggles for storage, memory, appearance, and clear-all-data.
