# Teddy Bud UI/UX Guidelines

## Product feel
**A little room to breathe.** Teddy Bud should feel calm, warm, mature, private, and reassuring. Build a focused companion—not a generic AI dashboard or a childish cartoon app.

## Visual system
- Light theme only; there is no dark mode.
- Warm ivory backgrounds, clay surfaces, cocoa primary actions, and restrained soft accents.
- Claymorphism with Material 3 foundations; avoid neon, harsh shadows, excessive glassmorphism, and decorative clutter.
- Follow an 8-point spacing rhythm.
- Keep typography readable, hierarchy clear, and interactive hit targets at least 44 dp where practical.
- Use motion purposefully: smooth and subtle, never distracting or blocking interaction.

## Layout and navigation
- Mobile and desktop must adapt without clipped content, stretched text, or obstructed controls.
- The central **+** creates a new chat immediately; do not route it to a generic action menu.
- Keep Settings easy to reach from primary navigation. The four primary sections are Chats, Discover, Memories, and Settings.
- Discover contains the Journal, emotional check-ins, wellbeing exercises, chat history, and privacy controls. Keep secondary tools there instead of crowding chat.
- Respect safe areas, keyboard movement, large text, reduced motion, screen readers, and focus order.

## Chat and forms
- Keep the composer clear, multiline, and easy to use.
- Show explicit loading, listening, disabled, error, retry, and success states.
- Never send a dictated transcript automatically; let users review and edit first.
- Keep voice input speech-to-text only. Do not add spoken replies, audio playback, or TTS controls.
- Explain destructive actions and ask for confirmation before deleting or replacing user data.
- Use plain, warm language. Avoid technical terms, raw errors, account-existence disclosures, and unsupported promises in user-facing copy.

## Account identity
- Use username and password, not email/Gmail.
- Display signed-in identity as `@username`.
- Recovery uses the configured recovery passphrase; explain that password recovery does not restore local chat history on another device.
- Offer Android biometric sign-in only after onboarding is complete, with password fallback.

## Accessibility and release
Check contrast, touch targets, text scaling, keyboard and focus behavior, screen-reader labels, reduced motion, and responsive layouts. A visual build or automated test alone does not prove UX completion; perform platform-specific smoke tests.


## Primary navigation icon motion
- Use a consistent, soft, custom-drawn icon family for Chats, Discover, Memories, and Settings; avoid mixed Unicode symbol styles.
- On tap or selection, use a brief spring scale with a restrained rotation/pop. Keep the movement small, warm, and purposeful rather than bouncy or distracting.
- Respect the operating-system/browser reduced-motion preference. When reduced motion is enabled, show the selected state immediately without movement.
- Keep icon hit targets generous, labels visible, and accessible names independent of the decorative artwork.
