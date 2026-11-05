# Teddy Bud feature and release status

Last reviewed: 2026-11-05. This file is a conservative status record: implementation in source, automated checks, and real-device verification are different levels of evidence.

## Product requirements that apply throughout the app
- Brand promise: **A little room to breathe.**
- Mature, warm claymorphism with Material 3 foundations; warm ivory/clay/cocoa palette; 8-point spacing rhythm; purposeful motion; accessible touch targets.
- Light theme only. No dark mode.
- Compact conversation-first experience. The central **+** starts a new chat immediately; Settings must be easy to reach; Journals belong in Discover; secondary tools should not crowd primary navigation.
- Username + password sign-in; no email/Gmail account identifier in the UI. Display account identity as `@username`.
- Optional Android biometric sign-in is offered after onboarding completion; password fallback remains available.
- Voice is speech-to-text input only. Users review/edit text before sending; no spoken replies, audio playback, or TTS.
- Local-first chats, memories, journals, and wellbeing entries; no automatic cross-device sync. Journal/wellbeing content is not shared with AI unless the user explicitly chooses to share selected content.

## Implemented foundations (automated verification does not equal device verification)
- Text chat through the authenticated gateway, with streaming and visible request states.
- Image attachment and server-side text/image model routing.
- Local memory, journal, and wellbeing surfaces documented in the current client.
- Encrypted local storage and encrypted portable backup/restore flows.
- Username-only account UI and Android biometric credential path were merged in PR #44. CI completed for the merge; real-device biometric/auth testing remains outstanding.
- CI produces Android ARM64, Windows x64/ARM64, macOS Intel/Apple Silicon, and Linux DEB/AppImage development packages.

## Explicit limitations
- No standalone web app; the React Native Web renderer is internal to development and Electron packaging.
- No iOS/iPhone/iPad release.
- No dark mode.
- No assistant voice output or TTS.
- No automatic cross-device data sync.
- Account recovery does not restore local history or encryption keys on another device.
- Do not claim end-to-end encryption for prompts sent to a remote inference provider.
- Development packages are not automatically signed, notarized, or store-certified.

## Planned or separately gated work
Treat roadmap items as planned until their code, tests, and platform acceptance evidence are present. Examples include optional reminders/widgets, encrypted cross-device sync, enterprise administration, and any paid entitlement/checkout system. Do not present roadmap entries as available features.

## Verification still required
- Real Android installation and complete username sign-in, recovery, onboarding, biometric enrollment/unlock, and password fallback.
- Device checks for permissions, keyboard/safe-area behavior, text scaling, screen readers, reduced motion, and accessibility contrast.
- Real runtime tests for chat streaming, image handling, offline states, backup/restore failure paths, and local-data preservation.
- Verify production gateway configuration and authenticated text/image requests separately from CI.
