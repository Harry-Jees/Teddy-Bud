# Teddy Bud UI/UX requirements and verification

## Current product direction
Deliver a calm, mature, conversation-first companion app—**A little room to breathe**—using warm ivory, clay, and cocoa tones, claymorphism with Material 3 foundations, an 8-point spacing rhythm, purposeful motion, and accessible touch targets. The app is light-only; there is no dark mode.

## Non-negotiable product behavior
- Username + password only in the app-facing account flow; no email/Gmail identifier. Display signed-in identity as `@username`.
- Android biometric sign-in can be enabled after onboarding is completed. Password sign-in remains available.
- Voice input is speech-to-text only. The user starts it, reviews and edits the transcript, then chooses to send. Never add spoken assistant replies or TTS.
- The central **+** action starts a new chat immediately.
- Settings must remain easy to reach; Journals belong in Discover; secondary tools should not crowd primary navigation.
- Chats, memories, journals, and wellbeing entries are local-first and do not automatically sync across devices.
- Journal and wellbeing text is not sent to AI unless the user explicitly chooses to share selected content.
- Password recovery must not imply that local chat history or encryption keys are recovered on another device.

## Quality checklist
- [ ] Consistent labels, tone, and account identity across every screen, dialog, validation error, empty state, tooltip, notification, and accessibility label.
- [ ] No obsolete email/Gmail sign-in copy, unsupported web/iOS claims, dark-mode references, or voice-output claims in user-facing text.
- [ ] Four primary mobile navigation destinations remain uncluttered; central plus starts a chat.
- [ ] Every failing action has visible, actionable feedback; no raw server errors or secret values are shown.
- [ ] Destructive actions explain consequences and require confirmation.
- [ ] Respect safe areas, keyboard behavior, responsive desktop layouts, large text, reduced motion, screen-reader labels, focus order, and contrast.
- [ ] Preserve existing local user data through upgrades and error recovery.
- [ ] Run lint, typecheck, tests, and platform builds; separately complete real-device smoke tests.

## Verification status
The current source has automated build/test evidence, but the Android username-auth and biometric flows, full accessibility matrix, and all-platform runtime behavior have not been confirmed on physical devices. Do not mark the UX fully verified solely because CI passes.
