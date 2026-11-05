# Teddy Bud — product roadmap

This roadmap records future work only. A roadmap item is not a shipped capability; use [Feature Status](./FEATURE_STATUS.md) for the current conservative status.

## Product guardrails
- Product promise: **A little room to breathe.**
- Warm, mature, uncluttered claymorphism with Material 3 foundations, 8-point spacing, and purposeful motion. Light theme only; no dark mode.
- Username + password account experience; show `@username`. No email/Gmail account identity in user-facing copy.
- Android biometrics are optional after onboarding completion; password fallback remains.
- Voice is speech-to-text input only. No generated speech, spoken assistant replies, voice playback, or TTS.
- Chats, memories, journals, and wellbeing data remain local-first; no automatic cross-device sync.
- Journal and wellbeing data are not sent to AI unless the user explicitly shares selected content.
- Do not claim end-to-end encryption for content sent to remote inference.

## Potential future work
### Local convenience
- Opt-in reminders and home-screen shortcuts, with quiet hours, privacy-safe notification text, and clear disable controls.
- Additional local wellbeing sessions and reflection tools, all optional and non-clinical.

### Personalization and accessibility
- Expanded memory review controls and clear explanation of what context is included in an AI request.
- Improve keyboard, screen-reader, reduced-motion, large-text, contrast, and responsive behavior across supported platforms.

### Infrastructure
- Consider encrypted cross-device sync only after a complete threat model, key recovery plan, device revocation, and conflict handling design.
- Enterprise routing and administration remain separate deployment work. Do not advertise self-service enterprise features until they exist and pass acceptance checks.
- Any paid plans require a verified entitlement, billing, reconciliation, refund, cancellation, and provider-cost accounting system before launch.

## Acceptance rule
Each feature must have explicit acceptance criteria, automated regression tests, privacy review, and platform-specific verification. Do not promote an item to “available” based on a design, a roadmap note, or a successful build alone.
