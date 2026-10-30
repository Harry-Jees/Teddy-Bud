# Voice, Interaction and Visual Quality Acceptance

This document is the implementation contract for the voice and UI completion work. It does not claim that any feature listed here is already implemented.

## Product quality rules

- Apply the 8-point spacing grid: 8, 16, 24, 32, 40, 48 and 64 dp/px where appropriate. Use 4-point optical corrections only where a platform control or icon alignment requires it; document exceptions.
- Preserve Teddy Bud's light claymorphism + Material 3 + soft-minimal visual language: warm ivory surfaces, cocoa accents, rounded but restrained geometry, subtle ambient elevation, and calm micro-interactions.
- Keep hierarchy clear: consistent page gutters, card padding, section spacing, typography scale, icon sizing, touch targets and responsive breakpoints.
- Avoid arbitrary one-off values, nested cards without purpose, inconsistent radii, crowded toolbars, clipped content, layout jumps and excessive motion.
- Respect reduced-motion settings, keyboard/safe-area insets, large text, screen readers and touch target guidance.
- No paid-tier, subscription, checkout or future paid-plan content in the core app.

## Voice experience

### Interaction states
1. Idle: microphone action is visible and clearly labelled; recording never starts automatically.
2. Permission request: explain why microphone access is needed before requesting it.
3. Recording: persistent visible recording state, elapsed time, waveform/level feedback, mute/pause where supported, and an obvious cancel/finish action.
4. Processing: show that audio is being transcribed; allow cancellation and recoverable retry.
5. Review: show editable transcription before sending, unless the user explicitly chooses a send-without-review preference.
6. Reply: render the normal Teddy Bud response and offer explicit play/stop controls for spoken output.
7. Error/denied: explain the problem in plain language and keep text chat fully usable.

### Speech input
- Implement native microphone capture on supported mobile targets with runtime permission handling.
- Implement browser capture on web/Electron only where secure-context and permission requirements are satisfied.
- Use a provider-backed transcription service through an authenticated gateway; never expose provider keys in the client.
- Validate audio type, duration and size at the gateway; enforce authentication, rate limits, request timeouts and safe temporary-file cleanup.
- Do not persist raw audio by default. Disclose any provider processing and retention before first use.
- Handle permission denial, device changes, interruptions, app backgrounding, network loss, empty/oversized recordings and duplicate submissions.
- Provide a complete text-only fallback on every platform.

### Expressive spoken replies
- Use a speech provider/model that supports natural prosody and expressive delivery, not merely a generic robotic system voice.
- Map the selected companion's established personality and the reply's conversational intent to conservative delivery controls: warmth, energy, pace, pauses and emphasis. Do not infer or announce a user's emotion as fact.
- Keep speech faithful to the assistant's visible reply; do not add unsourced words or change safety-critical meaning.
- Provide voice selection/preview, play/pause/resume/stop, replay and speech-rate controls. Persist preferences locally.
- Use sentence/chunk streaming where supported; cancel stale playback when the user sends a new message or navigates away.
- Handle audio focus, Bluetooth/headphones, phone calls, route changes, app lifecycle and output-device changes.
- Never autoplay spoken replies by default. Make audio playback an explicit user choice.
- Clearly disclose third-party processing, and do not retain generated audio longer than necessary.

### Voice acceptance tests
- Permission granted, denied, revoked and unavailable.
- Record, cancel, finish, review/edit transcript, submit, retry and stop.
- Network offline/timeout/401/429/5xx; malformed, empty and over-limit audio.
- App background/foreground, interruption, device-route changes and repeated taps.
- Correct companion voice profile, natural phrasing/prosody, no clipped sentence endings, no overlap/duplicate playback.
- Screen-reader labels and visible state for every voice control.
- Confirm no recording or playback begins without an explicit user action.

## Visual and interaction audit

Audit every screen and state in `client/App.tsx` and every imported component, not only the chat landing view:

- Authentication, onboarding, chat, history, memories, privacy, settings, emotions, journal, studio, discover and secondary navigation.
- Empty, loading, success, error, offline, expired-session, permission-denied and destructive-confirmation states.
- Short and long conversations, long unbroken text, code, images, attachments, keyboard-open state and large accessibility text.
- Phone portrait, phone landscape, tablet, desktop narrow and desktop wide layouts.
- Consistent 8-point spacing, page gutters, card insets, vertical rhythm, typography, line height, radii, shadows, icon alignment and hit areas.
- No horizontal overflow, overlap, clipping, content hidden behind keyboard/navigation, or unexpected layout shifts.
- Motion is purposeful, short and interruptible; reduced-motion mode removes nonessential movement.
- Focus order, accessible names, roles, live-region announcements, contrast and touch-target dimensions.

## Reliability, privacy and release gates

- Verify text and image chat on web and native transports, including streaming/buffered differences.
- Exercise stop, retry, regenerate, edit/resend, rapid submissions, duplicate prevention, timeouts and server errors.
- Verify local encryption, owner/account isolation, logout, storage/keychain failures, migrations, memory consent, backup merge/replace and interrupted-restore rollback.
- Verify gateway auth, rate limits, audio/image validation, request-size limits, provider error mapping and usage accounting.
- Run lint, type-check, unit/integration tests and platform builds from the same commit.
- Install and launch each release artifact on real target hardware; run production smoke tests with disposable accounts.
- Complete signing/notarization before calling desktop artifacts production-ready.

## Definition of done

A feature is complete only when implementation, automated tests, platform-specific validation and user-visible behavior all pass. A dependency in package.json, a visible button, a passing web build or a generated artifact alone is not proof of a working feature. Record platform-by-platform evidence and known limitations; never mark untested behavior as complete.
