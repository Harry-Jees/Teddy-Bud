# Teddy Bud feature and release status

Last reviewed: 2026-11-07. This file is a conservative status record: implementation in source, automated checks, and real-device verification are different levels of evidence.

## Product requirements that apply throughout the app
- Brand promise: **A little room to breathe.**
- Mature, warm claymorphism with Material 3 foundations; warm ivory/clay/cocoa palette; 8-point spacing rhythm; purposeful motion; accessible touch targets.
- Light theme only. No dark mode.
- Compact conversation-first experience with four primary tabs: Chats, Discover, Memories, and Settings. No oversized central **+** action; Journals, emotion tracking, guided wellbeing, history, and privacy controls belong in Discover.
- Username + password sign-in; no email/Gmail account identifier in the UI. Display account identity as `@username`.
- Optional Android biometric sign-in is offered after onboarding completion; password fallback remains available.
- Voice is speech-to-text input only. Users review/edit text before sending; no spoken replies, audio playback, or TTS.
- Local-first chats, memories, journals, and wellbeing entries; no automatic cross-device sync. Journal/wellbeing content is not shared with AI unless the user explicitly chooses to share selected content.

## Implemented foundations (automated verification does not equal device verification)
- Text chat through the authenticated gateway, with streaming and visible request states.
- Nine individual Teddy sticker assets are bundled separately. The assistant can attach a context-appropriate sticker using a private response marker or a conservative local intent fallback; recent-sticker cooldown and crisis-context suppression prevent overuse.
- Speech-to-text composer controls are wired to the existing Android speech-recognition module and supported browser Web Speech APIs. Dictation is user-initiated, editable, and never auto-sent; platform and physical-device verification remains outstanding.
- The current hardening branch adds soft animated icons for Chats, Discover, Memories, and Settings. Tap/selection motion is reduced when the device requests reduced motion.
- Image attachment and server-side text/image model routing.
- Local memory, journal, and wellbeing surfaces documented in the current client.
- Emotion Web and guided Wellbeing Studio are implemented in the current feature branch; the web build and automated client tests cover their source-level behavior, while device interaction still needs verification.
- The 24-question setup survey is stored locally. A separate Privacy control is off by default and explicitly opts in to sharing those answers as conversation context.
- Encrypted local storage and encrypted portable backup/restore flows.
- Username-only sign-in and Android biometric credential storage are implemented. First-run setup provisions one private space; the current hardening branch binds that device to its first successfully verified username and rejects a different username before contacting the account service. Older setup markers bind on the next successful sign-in. CI and physical-device auth/biometric testing remain separate.
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
- Real Android installation and complete username sign-in, first-run setup, recovery, onboarding, biometric enrollment/unlock, microphone permission, speech recognition, and password fallback.
- Device checks for permissions, keyboard/safe-area behavior, text scaling, screen readers, reduced motion, and accessibility contrast.
- Real runtime tests for chat streaming, image handling, offline states, backup/restore failure paths, and local-data preservation.
- Verify production gateway configuration and authenticated text/image requests separately from CI.


## Verification snapshot — 2026-11-07

- Client tests: 114 passed across 12 suites.
- TypeScript: npx tsc --noEmit passed.
- ESLint: npm run lint -- --max-warnings=0 passed.
- Web production bundle: npm run build:web passed.
- Full platform CI is expected to run against the feature branch after the changes are pushed. Android biometric, keyboard, swipe/navigation, and native sticker rendering still require the user's physical-device check.
