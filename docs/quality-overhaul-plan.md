# Teddy Bud quality and experience overhaul

## Goals
Deliver a stable Android-first release that preserves existing data and account identity while restoring Teddy Bud's warm, cozy product identity.

## Working branch
`overhaul/stability-cozy-ux`, based on the unmerged `fix/auth-media-icons-audit` work. Do not merge into `main` without explicit approval.

## Phase 0 — Baseline and diagnostics
- Record the exact branch SHA and existing CI state.
- Map navigation destinations, press handlers, screen mounts/unmounts, keyboard listeners, and native Android configuration.
- Reproduce reported exits where possible; distinguish JS exceptions, native crashes, ANRs, and OS memory kills.
- Add only privacy-safe diagnostics; never log credentials, tokens, message contents, or biometric data.
- Establish a regression test for each reproducible crash path.

## Phase 1 — Navigation and runtime stability (P0)
- Repair sidebar/secondary navigation actions and invalid destination transitions.
- Ensure tab tap and swipe navigation share one safe navigation path.
- Preserve nested Discover destinations and Android Back behavior.
- Audit async callbacks, unmounted state updates, native module calls, and modal/gesture interactions.
- Verify all navigation controls with automated tests and a physical Android smoke test.

## Phase 2 — Keyboard and layout correctness (P0)
- Keep focused inputs visible above the Android IME on login, recovery, survey, chat, journal, and settings forms.
- Verify `adjustResize`, safe-area/inset handling, scroll-to-focused-field behavior, and keyboard show/hide restoration.
- Keep chat composer and action row visible without overlapping the keyboard or bottom navigation.

## Phase 3 — Account identity and biometrics (P0)
- Enforce one configured account per device; after setup, show sign-in rather than account creation.
- Preserve device-account marker independently of the short-lived access session.
- Provide explicit fingerprint re-authentication on the sign-in screen when biometric enrollment exists.
- On biometric cancel/failure, safely return to password sign-in without clearing device setup.
- Keep biometric secrets local and hardware/OS protected; never transmit biometric data.
- Distinguish account recovery (server identity/password recovery) from importing local backup data.
- Test reinstall/restore and legacy migration paths without promising that Android Keystore credentials survive uninstall.

## Phase 4 — Chat and media (P1)
- Update mic/send controls and align the three composer actions on one row.
- Remove Share Reply.
- Render assistant stickers as separate transparent chat items, outside message bubbles.
- Trace image quality through source dimensions, encoding, storage, gateway, and rendering; avoid lossy downscaling.
- Enforce server-authoritative credit costs: text prompt = 1; image upload = 5. Use idempotent accounting and no charge on rejected/failed operations.
- Remove manual Refresh Tokens UI; show a progress bar with used/remaining balance based on authoritative values.

## Phase 5 — Design system and navigation motion (P1)
- Establish design tokens around warm ivory, soft clay, and cocoa; remove unrelated palette drift.
- Apply consistent rounded typography, including a distinctive Teddy Bud wordmark and stronger screen titles.
- Refine text fields, cards, buttons, headers, spacing, logo blend, and splash fade into warm ivory.
- Restrict restrained frosted-glass/raised active indicator treatment to bottom navigation only.
- Add distinct, low-amplitude icon motion; respect Reduce Motion.
- Implement meaningful haptic feedback for navigation and key interactions; respect Haptics settings.

## Phase 6 — Discover, Wellbeing Studio, and onboarding (P1)
- Move privacy controls out of Discover and into Settings.
- Redesign each Wellbeing Studio tool around its task instead of repeating one generic card layout.
- Improve survey hierarchy and vertical centering, question content, personalization choices (including Everything), and Next/Back state preservation.
- Ensure survey preferences are actually saved and used by the app.

## Phase 7 — Caring notifications (P2)
- Schedule a gentle local Android check-in after about three days of inactivity, subject to user preference and notification permission.
- Rotate casual, supportive copy and relevant emojis; avoid repetitive or guilt-inducing wording.
- Use appropriate notification channels, scheduling APIs, and quiet/cancellation behavior. Do not keep a background service running just to poll.

## Phase 8 — Security and release quality (P0/P1)
- Audit Android manifest, exported components, permissions, cleartext/network config, deep links, storage, backup behavior, logs, dependencies, and release/debug flags.
- Audit auth, gateway, image handling, token accounting, and import/export boundaries.
- Run lint, unit/integration tests, TypeScript, Android release build, dependency/security audit, and artifact inspection.
- Test app startup, all primary/secondary navigation, auth and biometrics, keyboard, media, notifications, offline/network failures, and Back navigation on Android.

## Acceptance criteria
- No known reproducible crash path remains; unresolved reports are explicitly documented with evidence needed.
- Navigation and keyboard regression tests pass.
- Existing account identity is never silently replaced; failed biometric auth does not trigger account creation.
- Credit costs are enforced by the trusted server and reconciled in the UI.
- No privacy controls remain in Discover.
- All screens use the approved palette and consistent typography; only bottom navigation uses glass-like treatment.
- CI passes on this branch and a fresh Android APK is produced for user testing.
- `main` remains untouched until the user explicitly requests a merge.

## Constraints and honesty
- Do not claim physical-device testing unless performed.
- Do not promise Play Protect or third-party scanner approval; report concrete findings and configuration checks.
- Do not clear user accounts, local databases, backups, or production data as part of debugging.
- Account-data import must use a user-selected, validated backup; it cannot import another service's private account credentials.
