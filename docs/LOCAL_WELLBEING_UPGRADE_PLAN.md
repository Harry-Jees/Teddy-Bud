# Teddy Bud — local-first wellbeing upgrade

## Non-negotiable architecture
- Chats, check-ins, journal entries, emotion ratings, insights, and preferences remain on the current device.
- No device-to-device sync, no server-side mood profile, and no background upload of wellbeing data.
- A user may move data manually using a password-encrypted `.teddybud` backup. Import must decrypt and validate before replacing or merging anything, show a preview, and require confirmation.
- Account authentication may remain online, but signing in on another device does not fetch the first device's private data. Explain this clearly in onboarding/settings.
- AI calls receive only the message/context explicitly needed for the current reply. Check-ins, journal text, and emotion history are never included by default.

## Emotion distribution visualization
Use a radar/web chart inspired by the supplied S/B/I/R/T/A/F chart. It is a descriptive reflection aid, not a diagnosis or scientifically validated assessment.
- Axes: Happy, Calm, Connected, Hopeful, Energized, Sad, Anxious, Angry, Lonely, Overwhelmed.
- User rates each selected emotion from 0–5 (or skips it); never infer scores from chats.
- Display the most recent check-in as a polygon over a faint multi-ring web, with labeled axes and an accessible textual summary.
- Separate positive/settled and difficult emotions visually without implying that difficult emotions are failures. Do not reduce a person to one score.
- Trends compare only user-entered check-ins and require enough entries; show dates and missing-data gaps honestly.
- All chart values are computed locally and can be edited/deleted with the source entry.

## Implementation status (branch: `migration/cloudflare-workers-ai-phonepe`)

- **Implemented in this branch:** local emotion check-ins with validated ratings, spider-web/radar-style chart geometry, local trend averages, entry deletion, private journal prompts/search/save/delete, offline wellbeing exercises, local persistence and inclusion in the encrypted backup payload.
- **Still requires verification:** TypeScript/lint/unit tests, web build, native builds, device testing, accessibility review, and encrypted backup round-trip tests on each platform.
- **Not yet implemented:** true account-level single-device enforcement, journal editing, journal export, conversation controls, voice, notifications, and end-to-end encryption. Do not describe these as shipped.

## Phased delivery

### Phase 0 — safety and data contracts
1. Audit local storage and backup format/versioning.
2. Define versioned local check-in and journal schemas with validation and migration.
3. Add explicit local-only copy to Privacy/Settings and sign-in screens.
4. Add unit tests proving local records are not serialized into gateway requests by default.
**Gate:** no remote write path for wellbeing records; malformed imports cannot corrupt existing data.

### Phase 1 — emotional check-ins + radar (build first)
1. Add optional check-in entry with timestamp, mood, energy, support preference, and emotion ratings.
2. Add local persistence to the existing encrypted/local store, with safe migration of older records.
3. Implement responsive radar/web chart and accessible summary.
4. Add history, edit, delete, empty state, skip flow, and reduced-motion behavior.
5. Test rating bounds, missing axes, dates/time zones, reload persistence, and backup round-trip.
**Gate:** manual ratings only, offline use, all data survives reload and is absent from network payloads.

### Phase 2 — private guided journal
1. Add prompt categories and blank-entry mode.
2. Add edit/delete/search/export and explicit “share this entry with Teddy” action.
3. Keep entries local; explain that explicitly shared text is sent to the configured AI service.
**Gate:** no accidental journal text in chat context or logs.

### Phase 3 — wellbeing studio
1. Offline breathing, grounding, focus break, and bedtime routines.
2. Pause/stop, optional haptics, accessibility labels, reduced-motion and sound-off support.
**Gate:** all core exercises function without network access.

### Phase 4 — insights and conversation controls
1. Opt-in weekly summaries based only on local check-ins and transparent calculations.
2. Edit/resend, regenerate, copy/share, and response style controls.
3. Prevent duplicate charging on regeneration/retry and test privacy boundaries.
**Gate:** no diagnosis, risk score, prediction, or unsupported mental-health claims.

### Phase 5 — portability and hardening
1. Verify `.teddybud` AES-256-GCM encrypted export/import on web, Android, Windows, macOS, and Linux.
2. Add import preview, merge/replace choice, duplicate handling, rollback on failure, and recovery instructions.
3. Verify account owner binding and ensure imported content cannot execute as markup.
4. Add storage status, local-data clear/export controls, and recovery drills.
**Gate:** wrong passphrase, corrupted files, wrong account, oversized files, and interrupted imports leave existing data unchanged.

## Simulated specialist review lanes
- **Product/UX reviewer:** clarity, non-judgmental language, empty/loading/error states, mobile layout.
- **Privacy reviewer:** local-only guarantees, explicit sharing, no sensitive analytics or network payloads.
- **Data/security reviewer:** schema validation, migration, backup encryption, rollback, account binding.
- **Accessibility reviewer:** screen-reader summary, keyboard navigation, contrast, reduced motion, touch targets.
- **QA reviewer:** unit/integration tests, reload persistence, platform checks, adversarial backup fixtures.

These are review lanes, not claims that independent AI agents or real-device tests have already run. Every finding must be reproduced, fixed, and retested before release.
