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
- Nine individual T¶»§q«^