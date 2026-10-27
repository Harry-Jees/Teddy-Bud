# Teddy Bud UI/UX Update Plan

Last reviewed: 2026-10-27  
Working branch: `feature/phase-3-chat-polish`  
Status: **Implementation in progress; current merge gate pending CI and platform verification**  
Scope: Mobile-first UX, all app screens, sign-in/password/recovery flows, error handling, accessibility, cross-platform behavior, regression tests, and release validation.

## 1. Goal and non-negotiable rules

Deliver a calmer, more predictable Teddy Bud app without losing access to existing chats or weakening privacy. Mobile navigation should contain **four icons total**: Chats, Memories, a boxed central **+** that starts a new chat immediately, and More. Journal and all other secondary tools belong in More. Secondary tools belong in **More**. The same feature set must remain reachable on desktop.

- [ ] Keep this file as the source of truth for the rollout; tick tasks only after implementation and verification.
- [ ] Do not redesign multiple unrelated flows in one risky commit; complete and test each phase before moving on.
- [ ] Preserve existing user data and provide a recovery route for every recoverable failure.
- [ ] Never show raw server/internal errors, stack traces, tokens, passwords, recovery passphrases, or other secrets to users.
- [ ] Never treat a network outage as proof that a session is invalid or that local data is missing.
- [ ] Never clear saved user data automatically to recover from a storage error.
- [ ] Keep account-existence protections: sign-in may say credentials are incorrect, but recovery/signup messages must not reveal whether a particular email is registered.
- [ ] Every action that can fail needs a visible, accessible, actionable result; every destructive action needs a clear explanation and confirmation.
- [ ] Every phase needs automated tests. UI completion is not established by a successful build alone.
- [ ] No production deployment, signing, or release promotion until all release gates in Phase 10 pass.


## Merge gate — 2026-10-27

- Pull request: https://github.com/Harry-Jees/Teddy-Bud/pull/12
- A fresh CI run was queued after the safe-area/menu-test fixes. Earlier runs tested older snapshots and failed, so they do not validate the final code.
- No claim of production safety is made until automated checks pass and actual mobile/desktop smoke tests verify existing conversations, switching accounts, storage recovery, backup/restore, and navigation.
- Existing user chats must remain stored and readable; no migration or cleanup is allowed to reset local conversation records as part of this UI work.

## Current execution log — 2026-10-27

The plan is now being executed on this branch. Items below describe code added so far; they are **not marked phase-complete until CI and relevant manual checks pass**.

### Initial implementation committed

- [x] Added a central, typed authentication error mapper that avoids displaying arbitrary server text and differentiates credentials, validation, rate limits, network failures, timeouts, service errors, session expiry, and storage failures.
- [x] Added inline sign-in form validation for email, password, password confirmation, and recovery passphrase fields; validation submits are no longer silently blocked without feedback.
- [x] Added accessible error announcements and clears stale field errors when users correct input.
- [x] Added explicit secure-session storage failure handling so sign-out does not silently pretend credentials were cleared when local storage removal fails.
- [x] Replaced the mobile seven-destination bar with **four icons total**: Chats, Memories, a boxed central **+**, and More; moved Journal into More.
- [x] Added a More screen for Chat history, Emotions, Wellbeing, Privacy, and Settings, while leaving the desktop sidebar hierarchy available.
- [x] Added small press-in scale feedback to common buttons and navigation, honoring reduced-motion preferences; enlarged common button and navigation targets.
- [x] Added safe, actionable messages for chat, quota, oversized-input, local database, backup, and external-link failures; preserved structured daily-quota error codes for specific user guidance.
- [x] Prevented chat stream updates from forcing users back to the bottom when they are reading older messages; added an accessible **Jump to latest** action and per-conversation scroll reset.
- [x] Made journal save/delete wait for the local persistence operation before clearing the editor or removing a row; failures keep the entry/text visible and display an actionable notice.
- [x] Added plain-text journal downloads on web/desktop and handled native share-sheet cancellation/errors.
- [x] Reworded corrupted local-data recovery guidance so it no longer recommends clearing saved data as the first response.
- [x] Added regression tests for interrupted chat reading position, jump-to-latest, and journal save/empty-state errors.
- [x] Added dedicated tests for authentication error mapping, browser auth request failures, form validation, compact navigation, More routes, and safe chat/local-data/backup messages.
- [ ] Run CI against the combined implementation commits and fix any failures before marking these items phase-complete.
- [ ] Capture and review mobile/desktop screenshots and execute real-device checks. Source code and unit tests alone do not establish visual or platform correctness.

### Research references used

- [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars/): keep navigation focused, preserve tab visibility, and put actions in controls rather than treating every action as a tab.
- [Apple Human Interface Guidelines — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons/): clear button roles, target spacing, and press feedback; Apple recommends 44×44 pt hit regions.
- [Apple Human Interface Guidelines — Motion](https://developer.apple.com/design/human-interface-guidelines/motion/): motion should be purposeful and respond to accessibility preferences.
- [Android Accessibility — Touch target size](https://support.google.com/accessibility/android/answer/7101858): recommended 48×48 dp targets with spacing.
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum): baseline Level AA target size of 24×24 CSS pixels with defined exceptions.
- [Nielsen Norman Group — Find navigation on mobile](https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/): use visible or combined navigation for important destinations and make hidden navigation discoverable.

## 2. Severity and completion rules

- **P0 — blocker:** risks account access, data loss, an inaccessible critical flow, or an unusable primary action.
- **P1 — high:** causes a common journey to fail, hides important errors, or can result in a confusing/recoverable failure.
- **P2 — medium:** creates friction, inconsistent behavior, or an accessibility/responsiveness defect.
- **P3 — polish:** low-risk visual refinements after critical flows pass.

A task is complete only when its code change, automated tests, narrow-screen check, relevant platform check, error state, and acceptance criteria are recorded. Use a separate commit per coherent task group. Do not mark an item complete merely because its UI renders.

---

## Phase 0 — Baseline, inventory, and test design

**Priority:** P0 foundation  
**Depends on:** none  
**Outcome:** a reproducible baseline so later fixes can be compared and regressions caught.

### Todo 0.1 — Map the application
- [ ] Inventory all reachable screens, overlays, modals, menus, forms, dialogs, and background actions.
- [ ] Map the mobile and desktop navigation routes and every way to reach Chat, History, Memories, Emotions, Journal, Wellbeing, Privacy, Settings, backup/restore, and sign-out.
- [ ] Document the sign-in, create-account, legacy-account migration, password recovery, session-expiry, and logout state transitions.
- [ ] Map local-data load/save/clear paths and backup export/import persistence points.
- [ ] List each user-visible error and its current source; identify raw server errors and silent catch blocks.
- [ ] Mark which failures are recoverable, retryable, cancelable, or destructive.

### Todo 0.2 — Establish a baseline
- [ ] Run the current client tests, type checks, lint checks where configured, web build, and gateway tests; record exact results.
- [ ] Capture screenshots/current behavior for the main screens before altering layout.
- [ ] Inspect narrow mobile widths (320, 360, 390, 430 px), tablet widths, and desktop widths (800, 1024, 1280, 1440 px).
- [ ] Repeat key screens with the keyboard open, large text, long labels, long messages, and an empty/slow/error state.
- [ ] Identify platform-specific behavior separately for Android, Windows, macOS, Linux, and web preview where supported by the client.
- [ ] Create a test matrix linking every issue to a task, a test, and a completion criterion.

### Todo 0.3 — Lock down interaction contracts
- [ ] Define global rules for loading, disabled, success, warning, recoverable error, fatal error, and empty states.
- [ ] Define when to use inline field messages, form-level alerts, non-blocking notices, native dialogs, and retry controls.
- [ ] Set expectations for preserving drafts and form input after recoverable failures.
- [ ] Define a non-sensitive error taxonomy and a safe mapping from gateway/backend status codes to user-facing language.
- [ ] Document data-retention and privacy wording to reuse consistently across screens.

**Exit gate:** baseline results and screen/state inventories are recorded; critical-flow tests are identified. No UI change is included in this phase.

---

## Phase 1 — Sign-in, account creation, password validation, recovery, and error notifications

**Priority:** P0  
**Depends on:** Phase 0  
**Outcome:** every authentication state gives understandable feedback and a safe way forward. This is a dedicated engineering phase, not a styling-only pass.

### Todo 1.1 — Normalize authentication errors
- [ ] Add a typed authentication error model that distinguishes validation, invalid credentials, rate limiting, offline/network failure, timeout, server unavailability, session expiry, malformed response, and secure-storage failure.
- [ ] Normalize HTTP errors, non-JSON responses, empty responses, native fetch failures, aborts, and unexpected exceptions in one shared layer.
- [ ] Map known backend responses to user-safe messages; do not display arbitrary backend text directly.
- [ ] Preserve an internal status/code for tests and diagnostics without logging credentials or personal form contents.
- [ ] Treat unexpected responses safely and provide a generic actionable fallback.
- [ ] Keep the message language consistent on web and native platforms.

### Todo 1.2 — Sign-in form behavior
- [ ] Validate a missing email and malformed email with a field-level message on submit.
- [ ] Validate an empty password without sending the request.
- [ ] Normalize email consistently with the backend contract; avoid silently altering a password.
- [ ] Show one generic **“Email or password is incorrect”** style message for invalid credentials rather than confirming which part was wrong.
- [ ] Show a clear offline/network message with a Retry action or safe resubmission path.
- [ ] Distinguish request timeout from incorrect credentials.
- [ ] Handle rate limit responses with a calm “too many attempts; try again later” message; honor a server-provided wait period when available.
- [ ] Handle gateway/server unavailable and unexpected response errors without exposing internal details.
- [ ] Retain email and other non-secret form context after recoverable failures; clear or retain password according to an explicit security policy rather than accidentally.
- [ ] Prevent duplicate submit requests and make the loading/disabled state visible until the request resolves.
- [ ] Ensure failed sign-in never leaves the user looking as though they are signed in.

### Todo 1.3 — Create-account/password validation
- [ ] Validate email, password minimum and maximum length, confirmation password, recovery-passphrase length, and recovery-passphrase confirmation before submitting.
- [ ] Show field-level messages for mismatched password and recovery passphrase; do not merely disable Create Account with no explanation.
- [ ] Align client-side validation limits and wording with the gateway's exact accepted limits.
- [ ] Explain password requirements beside the field, not only after submit.
- [ ] Handle an account creation failure with helpful, safe wording that does not expose whether an email already exists.
- [ ] Handle rate limits and network failures without clearing the form.
- [ ] Prevent duplicate account creation requests while pending.
- [ ] Verify successful server creation followed by local session-storage failure has a clear recovery path and never falsely reports success.
- [ ] Ensure the user can switch between sign-in and create-account modes without stale errors from the previous mode.

### Todo 1.4 — Password recovery and legacy migration
- [ ] Validate the recovery email, recovery passphrase, and new password before requesting recovery.
- [ ] Show clear password mismatch/length messages and actionable retry guidance.
- [ ] Give wrong recovery credentials a safe message without exposing whether an email exists or has a recovery verifier.
- [ ] Distinguish offline, timeout, rate-limited, server misconfiguration, and unexpected recovery failures without displaying secrets or configuration details.
- [ ] On success, tell the user the password was changed and direct them back to sign in.
- [ ] Test a session that cannot be migrated, a legacy session that expired, and a migration API failure.
- [ ] Ensure failure never clears chats or other local data.
- [ ] Ensure mode switching clears stale messages and only the intended fields.
- [ ] Test that account migration does not appear when no eligible legacy session exists.

### Todo 1.5 — Session restoration, expiry, and logout
- [ ] Separate “no session exists” from “could not validate session because the server/network is unavailable.”
- [ ] Do not silently convert a transient restoration failure into a logged-out state.
- [ ] Provide a retryable session-check error screen/state.
- [ ] Handle malformed session data, missing tokens, invalid expiry values, and secure keychain/storage read errors deliberately.
- [ ] On genuine expiry or revocation, explain that sign-in is required and return the user to authentication safely.
- [ ] Decide and test what happens to an unsent chat draft when the session expires.
- [ ] Handle logout success and logout network/server failure distinctly; ensure local credential cleanup follows the security policy and communicate the result accurately.
- [ ] Prevent duplicate logout/refresh transitions and state updates after a screen unmounts.
- [ ] Verify that expired/invalid tokens cannot continue sending requests.
- [ ] Verify a failed session write never leaves the app in a false authenticated state.

### Todo 1.6 — Error accessibility and password usability
- [ ] Use visible field-level errors plus a form-level announcement where appropriate.
- [ ] Associate each field's label, validation message, and invalid state for assistive technology.
- [ ] Move focus to the first invalid field or error summary on submit where supported.
- [ ] Announce async success/failure/loading transitions accessibly without repeatedly announcing every render.
- [ ] Make password entry, autofill metadata, capitalization behavior, and keyboard type correct on every platform.
- [ ] Evaluate an accessible show/hide password control without weakening secure-entry defaults.
- [ ] Ensure error text is not distinguished by color alone and remains legible at large text sizes.

### Authentication test checklist
- [ ] Unit-test every error mapping and safe fallback in the auth service.
- [ ] Test valid and invalid email, empty/weak/too-long password, mismatch fields, invalid recovery passphrase, and corrected retry.
- [ ] Test invalid credentials, 400 validation responses, 401, 429, 5xx, timeout, offline fetch rejection, malformed JSON, and missing access token.
- [ ] Test secure storage read/write failure on native and session storage failure on web/desktop bridge.
- [ ] Test startup restore success, absent session, expired session, revoked session, transient network failure, and retry.
- [ ] Test sign-in/create/recovery double taps and unmount/race conditions.
- [ ] Add dedicated authentication service tests and UI-state tests; current existing client tests do not include a dedicated browser-auth suite.

**Exit gate:** every auth state has a tested, understandable result. No raw internal/server error or credential is shown. No auth failure silently deletes local app data.

---

## Phase 2 — Mobile information architecture and navigation

**Priority:** P0 for primary navigation; P1 for refinement  
**Depends on:** Phase 0 baseline and Phase 1 auth behavior being stable  
**Outcome:** fewer persistent choices with no loss of existing features.

### Todo 2.1 — Mobile bottom navigation
- [x] Replace the seven-destination bottom bar with four icons total: Chats, Memories, a boxed central **+**, and More.
- [ ] Keep the central **+** visually distinct and make one tap start a fresh chat immediately, without opening an intermediate menu.
- [x] Set the four bottom-bar icons to Chats, Memories, central New Chat, and More; place Journal and secondary tools inside More.
- [ ] Make **More** open a clear destination list for Emotions, Wellbeing, Privacy, Settings, and other secondary tools.
- [ ] Ensure History remains easy to find from Chats and is not lost during the change.
- [ ] Preserve the selected destination and provide a visible, accessible current-state indicator.
- [ ] Prevent the central create button from being mistaken for Send, Add Memory, or an overflow menu.
- [ ] Make repeated tapping on **+** create one new conversation per deliberate action; prevent accidental duplicate creation.
- [ ] Keep the bar above bottom safe areas and mobile system gestures.
- [ ] Avoid labels/icons clipping at 320 px and with text scaling.

### Todo 2.2 — More screen
- [ ] Create a simple, scannable More screen with clear names and supporting labels for secondary tools.
- [ ] Group wellbeing tools separately from account/privacy actions.
- [ ] Keep Privacy and Sign out discoverable without placing destructive actions beside routine navigation.
- [ ] Show active selection and a back path that returns to the previous screen predictably.
- [ ] Preserve access to every currently implemented screen.
- [ ] Verify back-button/gesture behavior and web browser history behavior where applicable.

### Todo 2.3 — Desktop navigation parity
- [ ] Keep persistent desktop navigation and chat history accessible.
- [ ] Reflect the same information hierarchy without forcing the mobile bottom-bar layout onto desktop.
- [ ] Keep New Chat prominent in the sidebar and available from relevant desktop chat states.
- [ ] Test expanded/collapsed sidebar labels, tooltips, focus order, and pointer behavior.
- [ ] Ensure no destination is available only through hover.
- [ ] Verify browser back/forward and app-level navigation do not desynchronize selection.

### Todo 2.4 — Navigation regression
- [ ] Test every page-to-page route from both mobile and desktop.
- [ ] Test navigation while a response is streaming, while the keyboard is open, and with a modal/dialog open.
- [ ] Confirm active chat and draft handling when creating a new chat or switching pages.
- [ ] Confirm navigation remains usable with screen readers, keyboard-only input, and reduced motion.

**Exit gate:** all old tools remain reachable, New Chat is one tap from the center, navigation state is consistent, and navigation tests pass.

---

## Phase 3 — Chat, history, and message lifecycle

**Priority:** P0/P1  
**Depends on:** Phase 1 and Phase 2  
**Outcome:** the primary chat journey behaves predictably during success, error, retry, interruption, and navigation.

### Todo 3.1 — Chat screen layout
- [ ] Reduce mobile header crowding while preserving access to chat history, rename, and pin actions.
- [ ] Decide which actions belong in the header versus a compact chat-actions menu on small widths.
- [ ] Keep the message composer visible above the keyboard and safe areas.
- [ ] Preserve starter prompts as optional helpers, not competing primary controls.
- [ ] Verify long conversation titles wrap/truncate without covering actions.
- [ ] Review empty chat, one-message chat, long chat, and very long assistant-response layouts.

### Todo 3.2 — Send/stream/stop/retry
- [ ] Define and test an explicit state model: idle, preparing, sending, streaming, completed, failed, canceled, and retrying.
- [ ] Ensure Send cannot fire twice for a single pending message.
- [ ] Preserve a failed user message and let the user retry it without retyping.
- [ ] Show a clear reason and next action for timeout, offline, rate limit/credit exhaustion, server failure, authentication failure, and provider failure.
- [ ] Keep Stop available during generation, and make cancellation stop timers/stream updates cleanly.
- [ ] Preserve a partial reply only where the behavior is intentional and make its incomplete state understandable.
- [ ] Ensure a retry/regenerate/edit action cannot duplicate user messages or assistant responses.
- [ ] Verify 401/session restoration never loops indefinitely.
- [ ] Keep optional title generation and memory suggestions from turning a successful chat into a failure.
- [ ] Ensure a background-task failure cannot hide the main chat error or overwrite the latest state.

### Todo 3.3 — Scrolling and focus
- [ ] Do not force-scroll to the bottom while a user is intentionally reading older messages.
- [ ] Auto-scroll when appropriate for a new message, with a way to return to latest.
- [ ] Test streaming with long content, image messages, large accessibility text, and keyboard-open layout.
- [ ] Restore composer focus only when it helps the current action; avoid unexpected keyboard popping.
- [ ] Preserve draft text when navigating away or a recoverable send fails.

### Todo 3.4 — Image, link, and share flows
- [ ] Test supported image formats, unsupported formats, canceled picker, picker permission denial, invalid image, oversize image, and upload/model rejection.
- [ ] Preserve draft text if image selection or sending fails.
- [ ] Make image preview removal/replacement obvious.
- [ ] Report clipboard/share-sheet failures appropriately; do not claim an export/share succeeded before the platform confirms.
- [ ] Validate external-link opening errors and avoid silent failure for important links.
- [ ] Test Markdown links, code, lists, quotes, and very long unbroken strings.

### Todo 3.5 — History management
- [ ] Test listing, switching, rename, pin/unpin, delete confirmation, and empty history.
- [ ] Explain deletion consequences before removing a conversation.
- [ ] Prevent an action on an old/stale conversation from modifying the currently selected conversation.
- [ ] Ensure history changes persist and report save failures.
- [ ] Test many conversations, pinned conversations, long titles, duplicate-looking titles, and list performance.

**Exit gate:** main chat actions pass unit/integration coverage and manual narrow-device checks; no known draft/message-loss or retry-duplication defect remains.

---

## Phase 4 — Memories, journal, emotion check-ins, and wellbeing

**Priority:** P1  
**Depends on:** Phases 0–3  
**Outcome:** local wellbeing tools are easy to find, understandable, editable, and honest about what is shared.

### Todo 4.1 — Memories
- [ ] Make enabled/disabled state, storage location, and AI-sharing implications explicit and consistent.
- [ ] Test add, edit, forget, duplicate entries, empty state, maximum length, and save failure.
- [ ] Keep model-suggested memories opt-in; saving must require explicit user approval.
- [ ] Ensure dismissing a suggestion does not save it and stale suggestions cannot reappear after the setting is turned off.
- [ ] Explain that deleting a memory affects future context, not messages already sent to a provider.
- [ ] Handle storage failure without falsely showing that a memory was saved or forgotten.

### Todo 4.2 — Journal
- [ ] Check editor layout with keyboard open, long text, maximum-length text, and large fonts.
- [ ] Test create, edit, cancel edit, search, share/export, and delete.
- [ ] Preserve an unsaved entry through recoverable failures or confirm before discarding it.
- [ ] Explain export contents and verify the system share/download result before claiming success.
- [ ] Keep “Discuss with Teddy” as a prepared draft requiring review and a separate Send action.
- [ ] Make journal privacy wording consistent: local by default; text enters AI context only when the user deliberately shares it.
- [ ] Test zero entries, no search matches, malformed legacy records, and many entries.

### Todo 4.3 — Emotion check-ins
- [ ] Test valid, partial, canceled, and repeated check-ins.
- [ ] Ensure scores and labels are understandable and not diagnostic.
- [ ] Validate empty chart, one-entry chart, missing points, long history, and unusual screen sizes.
- [ ] Test edit/delete and confirmation behavior for saved check-ins.
- [ ] Ensure trend/reflection text is descriptive and does not imply clinical assessment.
- [ ] Handle failed saves and reload without showing unsaved entries as persisted.

### Todo 4.4 — Wellbeing tools and crisis resources
- [ ] Ensure every exercise can be started, paused/stopped, and exited without penalty.
- [ ] Honor reduced motion and avoid animations that users cannot comfortably stop.
- [ ] Test offline behavior and ensure no network dependency is implied for offline exercises.
- [ ] Verify crisis-resource labels, country-specific numbers, calling links, and official sites; handle failed link opening.
- [ ] Keep urgent support clear without repeatedly interrupting unrelated flows.
- [ ] Test keyboard/screen-reader navigation and small-screen layout.

**Exit gate:** data operations have positive/negative tests; privacy statements match actual data flow; none of these screens falsely reports an unsaved action as successful.

---

## Phase 5 — Privacy, settings, backup/restore, and local storage resilience

**Priority:** P0 for data safety; P1 for UI  
**Depends on:** Phases 0–4  
**Outcome:** data can be exported/restored safely, settings persist clearly, and storage problems never lead to accidental deletion.

### Todo 5.1 — Privacy and settings comprehension
- [ ] Group preferences by effect and explain which data remains local and which selected context may be sent with AI requests.
- [ ] Make memory suggestions distinct from previously saved memories; turning one off must not imply existing memories were deleted.
- [ ] Verify assistant display-name and character preferences persist and recover after restart.
- [ ] Test all toggles' loading, saved, failed-to-save, and disabled states.
- [ ] Explain per-device storage and the backup route for moving data between devices.
- [ ] Keep sign-out, clear-local-data, and delete actions clearly separated.
- [ ] Ensure any data-sharing option has a precise label and remains consistent with the actual request payload.

### Todo 5.2 — Encrypted backup export
- [ ] Validate missing owner, weak/missing passphrase, unavailable Web Crypto, too-large data, and file-write/download failure.
- [ ] Show progress for long operations if feasible and prevent duplicate export actions.
- [ ] Make clear that users must retain their backup passphrase; do not claim it can be recovered.
- [ ] Ensure no plaintext conversation/memory content is written into the backup envelope.
- [ ] Report success only after the file has actually been prepared/saved as supported by the platform.
- [ ] Treat file-picker cancellation as cancellation, not a failure.
- [ ] Test file extension, filename, size, and supported-format messaging.

### Todo 5.3 — Encrypted backup import/restore
- [ ] Test malformed JSON, unsupported version/parameters, bad base64, wrong passphrase, owner mismatch, tampered ciphertext, invalid records, and size limits.
- [ ] Preview imported counts and explain Merge versus Replace in plain language.
- [ ] Ensure Cancel leaves data byte-for-byte/logically unchanged.
- [ ] Persist the complete validated result before updating visible React state.
- [ ] Test failure during persistence and make sure the previous saved dataset remains available or is recoverable.
- [ ] Add failure-injection tests for interrupted writes and rollback behavior.
- [ ] Test merge de-duplication, conflicting IDs, newer/older snapshots, selected conversation validity, and preference preservation.
- [ ] Test restore for chats, memories, emotions, journal, character names, and sharing preferences.
- [ ] Replace browser prompt-based restore selection with a deliberate, accessible confirmation UI as part of the later UI implementation.
- [ ] Test restore and export on real Android and desktop targets.

### Todo 5.4 — Local database/storage failure handling
- [ ] Test initial database opening failure, read failure, write failure, clear failure, schema/migration failure, and retry after the underlying issue is resolved.
- [ ] Do not show stale state as saved after a failed write.
- [ ] Provide Retry with a safe recovery route; never make destructive clear-data the default.
- [ ] Put destructive clear-data behind explicit, platform-consistent confirmation that names all affected record types.
- [ ] Test repeated Retry, recover-after-failure, and stale in-flight write cases.
- [ ] Ensure restore/clear operations cannot race with autosave and overwrite newer records.
- [ ] Verify per-account isolation and that logout/account switching cannot display another account's local data.

**Exit gate:** backup/storage failure tests prove canceled/failed operations do not silently replace or clear existing user data; native and web confirmation paths are tested.

---

## Phase 6 — Shared design consistency and interaction polish

**Priority:** P2 after P0/P1 blockers  
**Depends on:** Phases 1–5  
**Outcome:** one consistent visual and interaction language across the full app.

### Todo 6.1 — Common components
- [ ] Inventory duplicate buttons, fields, cards, error banners, warnings, confirmations, loading indicators, and empty states.
- [ ] Standardize common spacing, radii, text hierarchy, icon sizing, disabled/pressed/focused states, and touch target sizes.
- [ ] Replace platform-dependent Unicode navigation glyphs with consistent icons where supported.
- [ ] Provide a shared error-banner/field-error/loading/empty-state pattern where it reduces duplication.
- [ ] Use clear destructive styling for destructive actions without relying on color alone.
- [ ] Avoid adding decorative boxes or extra prompts that compete with the main action.

### Todo 6.2 — Feedback and motion
- [ ] Give every primary action immediate feedback: pending, completed, recoverable failure, or disabled reason.
- [ ] Prevent repeated toast/banner stacking and clear stale notices at an appropriate state transition.
- [ ] Honor reduced-motion preferences in every animated interaction, not only the sidebar and typing indicator.
- [ ] Make transitions quick and consistent; avoid delaying interaction until decorative animation finishes.
- [ ] Ensure focus, pressed, selected, and hover states communicate the same action across platforms.

**Exit gate:** common components behave and read consistently; no cosmetic refactor causes a functional regression.

---

## Phase 7 — Accessibility, layout, and platform-specific verification

**Priority:** P1/P2  
**Depends on:** Phases 2–6  
**Outcome:** all core actions stay usable with real input methods and screen sizes.

### Todo 7.1 — Accessibility
- [ ] Audit semantic roles, accessible names, hints, selected/checked/disabled state, focus order, and announcement timing.
- [ ] Add or correct accessible names for all icon-only controls, especially New Chat, More, pin, rename, retry, close, and delete.
- [ ] Verify errors and success messages are announced once and remain available long enough to understand.
- [ ] Test keyboard-only navigation on desktop/web and focus recovery after dialogs close.
- [ ] Test screen reader navigation on Android and other available target environments.
- [ ] Test text scaling, high contrast/system appearance, contrast ratios, and content clipping.
- [ ] Verify motion reduction and that animations never communicate state exclusively.

### Todo 7.2 — Responsive and keyboard layout
- [ ] Test narrow portrait, larger portrait, landscape, split-screen, and resized desktop windows.
- [ ] Verify composer, form actions, bottom navigation, dialogs, keyboard, and safe-area insets never obscure one another.
- [ ] Verify scrollable content can always reach its final control.
- [ ] Test very long titles, URLs, email strings, error text, journal entries, and assistant responses.
- [ ] Check layout with device text size increased and with software keyboard visible.
- [ ] Review orientation and viewport changes during a pending request.

### Todo 7.3 — Platform adapters
- [ ] Verify Android keychain, system back behavior, file picker, share sheet, and external links.
- [ ] Verify Windows/macOS/Linux keyboard and window resizing, save/open dialogs, clipboard/share behavior, and external links.
- [ ] Verify web/desktop bridge storage errors and session persistence behavior.
- [ ] Check that a platform-specific capability is hidden or clearly unavailable rather than appearing clickable and failing silently.
- [ ] Record any platform limitation instead of claiming parity without verification.

**Exit gate:** all supported platforms have recorded smoke-test results, and critical controls are reachable by touch, keyboard, and assistive technology where supported.

---

## Phase 8 — Regression suite, fault injection, and error-state coverage

**Priority:** P0 release gate  
**Depends on:** Phases 1–7  
**Outcome:** behavior and recovery paths are tested rather than inferred from a successful build.

### Todo 8.1 — Required automated coverage
- [ ] Add dedicated authentication service tests and form-state tests.
- [ ] Add navigation tests for every destination, More item, New Chat, back navigation, and current selection.
- [ ] Expand chat tests to include network timeout, offline failure, 401 refresh/expiry, 429/credit exhaustion, 5xx, cancellation, partial stream, retry, image failure, and duplicate send.
- [ ] Expand local-data tests to cover storage failure, recovery, per-account isolation, failed deletion, migration, and save ordering.
- [ ] Expand backup tests for invalid schema, wrong passphrase, owner mismatch, bad/tampered envelope, cancel, interrupted persistence, rollback, merge, replace, and preservation of current data.
- [ ] Test every error banner/button's accessible name, announcement role, retry action, and removal/reset behavior.
- [ ] Add regression tests for each real defect found during manual testing.

### Todo 8.2 — Error-state matrix
- [ ] Authentication: validation, invalid credentials, rate limit, timeout, offline, server failure, malformed response, secure storage error, revoked/expired session, and recovery/migration failure.
- [ ] Chat: timeout, no connection, provider/model failure, no credits, bad image, stream interrupted, canceled request, send/save failure, and stale-session response.
- [ ] Data: unavailable database, read/write failure, invalid saved data, failed deletion, merge conflict, failed restore persistence, failed export, and file cancellation.
- [ ] UI/platform: picker/share cancellation, permission denial, clipboard failure, external-link failure, window resizing, keyboard overlap, and lost focus.
- [ ] For every error: confirm message wording, next step, retry eligibility, data preservation, logged diagnostic fields, and privacy implications.

### Todo 8.3 — Diagnostics and privacy
- [ ] Use redacted structured diagnostics for unexpected failures, with no password, recovery passphrase, bearer token, private message text, or full backup contents.
- [ ] Avoid logging user-written journal/memory/chat contents to make errors easier to debug.
- [ ] Give unknown errors a generic user message plus an internal diagnostic identifier when support workflows justify it.
- [ ] Check console output for unhandled promise rejections and noisy errors from expected cancellations.
- [ ] Ensure error recovery doesn't create infinite retry loops or unbounded requests.

**Exit gate:** CI passes with the new tests, error-state matrix has no unexplained P0/P1 gaps, and regression tests cover every fixed bug.

---

## Phase 9 — Manual journeys and usability review

**Priority:** P0/P1  
**Depends on:** Phases 1–8  
**Outcome:** the whole app is reviewed as a user journey, not just as individual components.

### Todo 9.1 — End-to-end journeys
- [ ] Fresh install → create account → validate errors → successful first chat.
- [ ] Existing user → valid/invalid sign-in → app opens correctly.
- [ ] Sign-in offline/timeout → retry after connection returns.
- [ ] Password recovery success/failure → return to sign-in.
- [ ] Session expires while idle and during a pending chat; recover without losing saved content.
- [ ] Start chat from central **+** → send/stream → stop → retry failure → browse history → return to active chat.
- [ ] Add/edit/forget a memory; disable suggestions; verify no automatic save.
- [ ] Write/edit/search/export journal; discuss with Teddy only after review and deliberate Send.
- [ ] Add/delete emotion check-in; use and exit each wellbeing exercise.
- [ ] Export backup → cancel import → import wrong passphrase → merge → replace after clear warning.
- [ ] Cause local write failure → retry → confirm saved data and UI are synchronized.
- [ ] Sign out and sign in again; verify account isolation and correct data ownership.

### Todo 9.2 — Visual and interaction review
- [ ] Compare updated screenshots to Phase 0 baseline.
- [ ] Check tap-target size, clutter, line wrapping, hierarchy, contrast, focus, empty/loading/error/success states.
- [ ] Confirm no unintended changes to brand/color system or page structure outside approved phase scope.
- [ ] Ask a reviewer unfamiliar with the code to complete the primary mobile tasks and note any hesitation or ambiguity.
- [ ] Log new bugs as separate checklist items rather than silently expanding a completed phase.

**Exit gate:** every critical journey has passed on at least one real supported mobile target and one desktop target; platform-specific runs are recorded.

---

## Phase 10 — Release readiness and final acceptance

**Priority:** P0 release gate  
**Depends on:** all previous phases  
**Outcome:** a verified candidate, not merely code that compiles.

### Todo 10.1 — Technical checks
- [ ] Run client tests, gateway tests, TypeScript checks, lint/static checks where configured, and web build on the final candidate commit.
- [ ] Build every supported package from the same exact commit.
- [ ] Verify Android ARM64, Windows x64/ARM64, macOS Intel/Apple Silicon, and Linux package targets as configured.
- [ ] Run the exact distribution-file verifier and inspect every produced filename, size, architecture, and checksum/source where available.
- [ ] Install and launch the actual generated packages; do not rely exclusively on build success.
- [ ] Review signing/notarization and installer warnings appropriate to each platform.

### Todo 10.2 — Final quality gates
- [ ] Re-run the full error-state matrix and all P0/P1 manual journeys against the release candidate.
- [ ] Verify the exact deployed gateway configuration with a disposable test account before production smoke tests.
- [ ] Smoke-test authenticated text requests and image/vision requests only where credentials/configuration are deliberately available.
- [ ] Confirm no real account secrets or private user data were exposed in logs, CI output, screenshots, or test fixtures.
- [ ] Confirm no billing, enterprise, voice, notification, or platform capability is advertised as complete unless its own gate is passed.
- [ ] Write a final audit report with passed, failed, blocked, and not-tested items plus evidence links.
- [ ] Do not merge, deploy, or announce completion until the user explicitly requests the next release action and all applicable gates pass.

**Final acceptance criteria**
1. Mobile navigation contains four icons total—Chats, Memories, a boxed central **+** for immediate New Chat, and More—with Journal and all other secondary tools reachable through More.
2. Every sign-in/password/recovery state displays accurate, safe, accessible feedback and preserves user data on recoverable errors.
3. Every major data-mutating action has reliable success/failure feedback, cancellation behavior, and regression coverage.
4. Every high-priority issue from the audit is closed or explicitly recorded as blocked with a reason.
5. Tests, package builds, and manual platform checks apply to one exact commit.
6. No UI, merge, deployment, or release is claimed complete without verifying the relevant artifact/runtime.

---

## Execution tracker

Use this summary to track progress between phases:

| Phase | Status | Completion evidence |
|---|---|---|
| 0 — Baseline and inventory | In progress | Baseline results, screen/state inventory, test matrix |
| 1 — Authentication and errors | Implementation in progress; CI pending | Auth error map, dedicated tests, recovery-state evidence |
| 2 — Navigation | Implementation in progress; CI pending | Mobile/desktop route tests and screenshots |
| 3 — Initial error-path updates; full phase pending | Send/stream/retry/history tests and journey evidence |
| 4 — Journal save/export failures improved; full phase pending | Data operation and privacy-consent tests |
| 5 — Initial error-path updates; full phase pending | Fault-injection, restore safety, preservation tests |
| 6 — Shared UI consistency | Not started | Component consistency review and regression results |
| 7 — Accessibility/platforms | Not started | Recorded device/keyboard/screen-reader checks |
| 8 — Tests added; CI pending | CI links and completed error-state matrix |
| 9 — Manual journey review | Not started | Journey checklists and screenshot comparisons |
| 10 — Release readiness | Not started | Final commit, builds, install/launch checks, report |

**Current verified state:** this is a planned work breakdown based on the code/documentation review. It is not a claim that the listed implementation or manual tests have been completed.
