# Product Requirements — Teddy Bud

## Product promise
**A little room to breathe.** Teddy Bud is a private, calm AI companion for everyday conversation and personal reflection. It is not a generic AI dashboard, therapist, emergency service, or substitute for professional care.

## Experience principles
- Mature, warm, soft UI using claymorphism with Material 3 foundations.
- Warm ivory, clay, cocoa, and restrained soft accents; no neon, childish cartoon styling, excessive glass, or dark mode.
- Use an 8-point spacing rhythm, clear typography and hierarchy, accessible touch targets, responsive layouts, and purposeful transitions.
- Keep the experience simple and conversation-led. Do not add generic document-upload or productivity surfaces.
- The central **+** starts a new chat immediately. Settings stays easy to reach; Journals belong in Discover; secondary tools should not crowd primary navigation.

## Core capabilities
- Text chat with streamed responses, conversation history, and visible loading, retry, and failure states.
- Image understanding through image attachments in chat.
- Speech-to-text input only: the user initiates recognition, reviews and edits the transcript, then sends it. No generated voice, spoken replies, or voice playback.
- User-managed memories with explicit controls over what context may be shared with an AI request.
- Local-first journals and wellbeing entries. They are not sent to AI unless the user explicitly chooses to share selected text.
- One account per device, username and password only. Display identity as `@username`; do not present email/Gmail as an account identifier.
- Password recovery may use the account recovery passphrase. Recovery must not imply that local history or encryption keys can be restored on another device.
- Android biometric sign-in may be enabled after onboarding completion. Password remains the fallback.
- Free-first usage policy: 40 credits per UTC day; each text or image request costs one credit. Credits are usage limits, not exact provider-cost accounting.

## Data and privacy
- Keep conversations, memories, journals, wellbeing data, and preferences local to the device with platform-appropriate encryption.
- Do not claim cross-device synchronization or end-to-end encryption.
- Send only the prompt and user-permitted context required for a response through the gateway.
- Do not automatically include journal entries, mood data, or other sensitive personal context.
- Password recovery does not recover another device's local data encryption key.

## Platforms
Supported targets are Android ARM64 and desktop packages for Windows x64/ARM64, macOS Intel/Apple Silicon, and Linux x64. The browser renderer is internal to development and Electron packaging, not a standalone hosted web app. iOS/iPhone/iPad is not currently offered.

## Release quality
A successful build is not feature-completion proof. Require automated tests, lint/type checks, package verification, accessibility review, and install/launch tests on target devices. Mark platform or feature support only when evidence exists.
