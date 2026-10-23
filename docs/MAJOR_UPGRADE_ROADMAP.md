# Teddy Bud — major upgrade roadmap (10 features)

This roadmap is separate from the Free-first launch. The launch should first ship reliably with the current four Free personalities, 40 daily credits, GLM text routing, Qwen image understanding, and no paid checkout. Do not add a feature to the release build until its acceptance checks pass on supported platforms.

## The 10 proposed features

### 1. Daily emotional check-in
A lightweight optional check-in for mood, energy, and what kind of support the user wants. Users can skip it and choose whether entries stay on-device.
- **Acceptance:** no mandatory onboarding gate; editable/deletable entries; no mood inference without user input; works offline.

### 2. Private journal with guided prompts
A standalone journal with prompt packs for reflection, gratitude, school/work stress, relationships, and small wins.
- **Acceptance:** entries are encrypted at rest where platform support permits; local-first storage; export and delete controls; journal text is never sent to AI unless the user explicitly chooses to share it.

### 3. Wellbeing studio
Short guided breathing, grounding, focus breaks, and bedtime wind-down sessions with calm animation and optional haptics.
- **Acceptance:** fully usable without network or AI; pause/stop controls; reduced-motion mode; no health or treatment claims.

### 4. Mood and habit insights
Optional weekly summaries from check-ins and journal tags, with clear explanations of how each insight was calculated.
- **Acceptance:** opt-in only; no diagnosis, risk score, or claims to predict mental-health conditions; users can inspect and delete the source data.

### 5. Voice notes and spoken replies
Let users record a short voice note and optionally hear a companion reply read aloud. Start with device-native speech APIs where available; evaluate privacy and cost before adding cloud transcription.
- **Acceptance:** recording is never automatic; visible recording state; permission denial fallback to text; playback controls; disclose if audio leaves the device.

### 6. Better conversation controls
Add edit-and-resend, regenerate response, copy/share selected text, and a clear “use less advice / listen first / be more practical” response-style switch.
- **Acceptance:** editing does not silently overwrite history; regenerated replies do not double-charge; controls are keyboard and screen-reader accessible.

### 7. User-controlled memory timeline
A review screen showing saved facts, source, last-used time, and controls to edit, pause, expire, or delete each item.
- **Acceptance:** suggestions require approval; deletion removes the memory from future prompts; sharing preferences are explicit; no automatic sensitive-memory capture.

### 8. Local-first reminders and companion widgets
Optional daily check-in reminders and a home-screen shortcut/widget to resume a chat or open a wellbeing exercise.
- **Acceptance:** notifications are opt-in, quiet hours are respected, no sensitive message content appears on the lock screen by default, and reminders are easy to disable.

### 9. Encrypted cross-device sync
An opt-in sync mode for chats, memories, and journal data using end-to-end encryption, with recovery and device management designed before implementation.
- **Acceptance:** server cannot read plaintext content; documented key recovery trade-offs; conflict handling; device revocation; backup remains available as a fallback.

### 10. Enterprise local-model deployment
A separately configured enterprise gateway can route text and supported vision requests to organization-managed inference (for example, an OpenAI-compatible vLLM/Ollama gateway) or to Cloudflare Workers AI.
- **Acceptance:** administrators configure endpoints and credentials server-side; TLS/authentication, model allowlists, timeouts, request limits, audit-safe metrics, and local-only mode; clients cannot submit arbitrary URLs; vision capability is checked per model.

## Delivery phases

1. **Launch hardening (now):** finish and validate the 40-credit Free tier, image upload, personality locks, UTC reset, rate limits, and cost monitoring. Keep the current production Worker unchanged until staged tests pass.
2. **Core wellbeing (next):** features 1–3. Keep them local-first and make AI optional.
3. **Personalization (after core stability):** features 4, 6, and 7. Add opt-in controls and regression tests before introducing insights.
4. **Accessibility and convenience:** features 5 and 8, with platform-specific fallbacks and permission testing.
5. **Infrastructure expansion:** feature 9 only after a threat model and key-recovery design; feature 10 as an administrator-managed deployment option with security review.

## Shared quality gates

- Unit tests for quota accounting, UTC reset, retry/refund, image routing, and task metering.
- Client typecheck, unit tests, web renderer build, Android release build, and desktop package build.
- Real-device checks for image selection, permissions, keyboard/screen-reader behavior, and low-connectivity states.
- Accessibility checks: text scaling, contrast, focus order, reduced motion, and touch target sizes.
- Privacy review: data inventory, consent boundaries, deletion behavior, telemetry minimization, and dependency/secret scan.
- Cost review: measure actual model usage and Cloudflare charges before setting paid quotas or prices.
- Never advertise Pro/Premium checkout or enterprise self-service until those capabilities are implemented, tested, and deployed.
