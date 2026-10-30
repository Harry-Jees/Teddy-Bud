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


## Cloudflare Workers AI voice model decision

The connected Cloudflare account contains the existing `teddy-bud-browser-gateway` Worker, with an `AI` Workers AI binding already configured. Keep voice inference inside this authenticated gateway; never call Workers AI directly from the app or expose credentials.

### Selected model candidates
- Speech-to-text default: `@cf/openai/whisper-large-v3-turbo`. Cloudflare documents this as Whisper Large v3 Turbo and prices it at $0.0005 per audio minute (46.63 Neurons/minute).
- Low-cost text-to-speech default: `@cf/myshell-ai/melotts`. Cloudflare describes it as high-quality multilingual TTS; the documented unit rate is $0.000205 per generated audio minute (18.63 Neurons/minute). The model accepts a `prompt` and `lang`, and returns MP3 audio.
- Expressiveness benchmark: `@cf/deepgram/aura-2-en`. Cloudflare describes context-aware natural pacing, expressiveness and fillers. It supports named speakers and real-time/batch inference, but is materially more expensive at $0.03 per 1,000 input characters (2,727.27 Neurons/1k characters) and is English-only in this model variant.

Workers AI currently includes 10,000 Neurons/day at no charge across the account. This is a shared daily allowance, not a separate voice-only quota; usage resets at 00:00 UTC. At the published rates, MeloTTS's allowance is roughly 537 generated audio minutes/day before other Workers AI usage, while Aura-2's allowance is roughly 3,666 characters/day before other usage. Actual usage depends on model accounting and the rest of the account's inference.

### Implementation decision
- Start with MeloTTS as the cost-efficient default, but do not describe it as the most expressive until listening tests confirm that.
- Benchmark Aura-2 English using the same Teddy Bud sample scripts for warmth, natural pauses, emotional appropriateness, pronunciation and latency. If quality is clearly better, expose it only as a consciously selected high-quality option with transparent usage limits; never silently switch users onto the expensive model.
- Use Whisper Large v3 Turbo for transcription. Do not store raw recordings by default.
- Keep model IDs, per-user limits, request size/duration limits, auth, rate limiting and usage accounting on the Worker.
- Voice quality test set must include comforting, cheerful, calm, explanatory and neutral replies. Companion personality controls should shape the TTS prompt without exaggerating emotion, changing meaning or pretending to diagnose the user's feelings.

### Connected Cloudflare inspection
- Worker found: `teddy-bud-browser-gateway`.
- Workers AI binding `AI` is already present.
- Existing authenticated routes include `/v1/models` and `/v1/chat/completions`; voice endpoints still need to be implemented and tested.
- The deployed Worker is currently the gateway's production version. Do not overwrite it with untested voice code. Develop and validate a version/branch first, then deploy deliberately after endpoint, auth, quota, audio-size and rollback checks.
