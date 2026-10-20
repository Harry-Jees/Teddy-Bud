# Teddy Bud — Architecture, Security and Delivery Audit

> Historical audit snapshot: the findings below describe the repository at the
> revision and date shown, not the current implementation. Authentication,
> email verification, session expiry, and local account-key isolation were
> subsequently changed. See [Security and Privacy](SECURITY_AND_PRIVACY.md)
> and [Technical Architecture](TECHNICAL_ARCHITECTURE.md) for the current
> behavior. The external Supabase and Cloudflare configuration still requires
> deployment-side verification.

Date: 2026-10-19
Reviewed revision: main at e8c15b936fd9de60d1f822ba8384fee735669930
Audit branch: audit/security-hardening-2026-10

## Scope and confidence

Reviewed the tracked React Native/React Native Web client, gateway Worker, Electron wrapper, Android signing configuration, CI workflow, privacy manifest, backup service, and related tests through GitHub. This is a source/configuration audit. No local build, emulator, live OAuth flow, live NVIDIA request, deployed Worker test, or visual/accessibility test was executed in this audit. Do not interpret source inspection as proof that a release works or that a live service is secure.

## Critical/high-priority findings

### High — public health endpoint could amplify upstream traffic
Before this branch, unauthenticated GET /health called NVIDIA /models on every request using the server-side key. This allowed anonymous callers to trigger repeated upstream requests. Changed health to a cheap readiness/configuration response without an upstream call, and added regression coverage.

### High — authenticated model/chat routes lacked account-level throttling
A valid account could repeatedly call model discovery and chat completion endpoints without a per-account request limit. Added per-account limits (120 model-catalog requests and 60 chat requests per 15-minute window) and regression coverage. Verify product usage against real traffic before tightening further.

### High — caller-controlled generation budgets
The gateway forwarded caller-supplied max_tokens and large text contexts with no server-side text-budget cap. Added a 2,048 output-token ceiling and an 80,000-character text-context limit, with regression tests. The HTTP body limit remains 1 MiB.

### High — browser chat data is not encrypted at rest by the app
The web/Electron UI uses IndexedDB for chat history, memories, and preferences. The README already discloses that this is not application-encrypted. Same-origin script compromise (including an XSS bug or compromised dependency) could read that data. Native storage uses SQLCipher and a platform secure key store; desktop session tokens use Electron safeStorage. Before making stronger privacy claims, add an explicit browser privacy warning and evaluate user-controlled encrypted local storage or a browser-specific key-management design.

## Medium-priority findings

### Medium — debug signing key and local browser artifacts were tracked
The Android debug keystore and Playwright debugging files were in source control. Removed the keystore from the branch, removed the ignore exception that allowed it to be tracked, removed local browser artifacts, and added the browser-artifact folder to root .gitignore. The Android debug build now uses the Android Gradle plugin's local default debug signing configuration. Confirm Android CI succeeds before merging. The key was a debug key, not a production release key.

### Medium — provider and account integration tests are mostly mocked
Worker tests cover OAuth, session behavior, rate limiting, and error cases, but they do not prove the deployed Supabase OAuth configuration or live NVIDIA model access works. Add a manual staging smoke test for sign-in, refresh/logout, model listing, chat completion, and model fallback; never expose provider secrets in CI logs.

### Medium — browser token storage is sessionStorage
Web sessions use sessionStorage, which is shorter-lived than localStorage but still accessible to same-origin JavaScript. This is a documented browser threat-model trade-off; reduce XSS risk, keep dependencies updated, and consider a same-site backend session/BFF if the architecture evolves.

### Medium — cross-origin policy is permissive
The gateway sends Access-Control-Allow-Origin: * on responses. Current endpoints use bearer tokens rather than cookie authentication, so this is not by itself a cookie-CSRF vulnerability, but an explicit production web-origin allowlist would reduce unintended browser access and make deployment boundaries clearer. Test native, local, and production web clients before changing it.

### Medium — emotional/crisis support relies partly on phrase matching
Crisis signals are regex-based and can miss indirect, multilingual, slang, or context-dependent expressions, and can also trigger incorrectly. Keep the app clearly non-clinical; evaluate the crisis flow with human-reviewed scenarios in supported locales and ensure it always offers a safe route to real-world support.

### Medium — build/release supply-chain hardening
The CI workflow uses major-version action tags, produces unsigned development artifacts, and commits generated distributions to the triggering branch. For production, pin third-party Actions to reviewed commit SHAs, enable dependency/security scanning, keep signing keys in protected CI secrets, and publish immutable versioned release assets. Do not use debug builds as production releases.

### Medium — multiple configured NVIDIA keys are not rotated
The key lookup returns the first non-empty NVIDIA_KEY_1 through NVIDIA_KEY_10 value. It does not rotate to another key after a quota/rate-limit/provider failure. This is not a safe key pool/failover design; if multiple keys are introduced, add server-side rotation with cooldown and carefully classify retryable errors. Keep all keys exclusively in Worker secrets.

### Low — health is now readiness, not upstream reachability
The new public health response confirms that a provider key is configured but intentionally does not make a live NVIDIA request. A ready response therefore does not prove that the provider endpoint or configured model is currently available. If operational health checks are needed, use a scheduled or authenticated diagnostic with caching and strict budgets rather than exposing a billable upstream check to anonymous traffic.

### Medium — Android release hardening
Release minification is disabled and versionCode/versionName are static. Before Play Store delivery, review R8/ProGuard compatibility, increment versions automatically, validate release signing inputs, and test a signed release build. Do not commit release keystores.

## UI/UX and accessibility findings

### Medium — contrast failures in supporting labels
Source color calculations show several small-text colors below WCAG AA's 4.5:1 normal-text target on their backgrounds: #9B9085 on white is about 3.12:1, #A79B8F on white about 2.72:1, #8E8175 on white about 3.79:1, #A2968A on white about 2.89:1, and #A65F50 on #FCE9E3 about 4.09:1. The main muted text color #73736E on white is about 4.77:1. Fixed in the current audit branch: darkened the muted/disabled/section-label and error colors, including the crisis-support body copy, to improve contrast. Re-run automated contrast checks and visually review the warm palette before merging.

### Medium — many labels are extremely small
The UI uses numerous 9–12 px labels and helper texts. Increase minimum body/supporting sizes where practical, preserve platform font scaling, and test Android/iOS dynamic type and browser zoom without clipped controls.

### Medium — Unicode symbols are used for navigation icons
Navigation uses text glyphs such as ◌, ✳, and ⌑ rather than a consistent icon family. Glyph appearance and alignment vary across operating systems and fonts. Use a consistent vector icon set, standard icon sizes, and accessible labels; avoid relying on the glyph alone to communicate meaning.

### Medium — chat history renders in a ScrollView
The conversation view renders all messages inside a ScrollView. Long-running conversations can increase render work and memory use. Consider a virtualized list with stable message keys, preserved scroll position, and correct behavior when new messages arrive.

### Medium — large UI surface in one file
The main UI is concentrated in a roughly 1,500-line App.tsx file, including multiple screens, chat rendering, dialogs, and styling. Split by feature (chat, history, memories, privacy, settings, shared controls) with explicit props and testable components before adding more functionality.

### Medium — accessibility needs device-level validation
The app already has many accessibility roles and labels, but modal focus behavior, screen-reader announcements for new replies/errors, dynamic font scaling, keyboard-only web use, contrast, touch targets, and reduced-motion behavior still need manual validation. Add stable test IDs and cross-platform interaction tests for critical flows.

## Positive findings

- Supabase Google OAuth uses PKCE and validates the provider identity/profile before issuing app sessions.
- Gateway JWTs are signed and session-backed; logout removes the server-side session.
- Native local storage checks SQLCipher availability and stores its key in platform secure storage.
- Electron enables context isolation, disables Node integration, uses sandboxing/webSecurity, restricts navigation and external URLs, and adds a CSP.
- Encrypted backups use PBKDF2-SHA-256 and AES-256-GCM with account binding and input validation.
- The client has unit tests for local data, backups, conversation safety, gateway behavior, and model selection.

## Changes made on this branch

- Avoided unauthenticated upstream requests from /health.
- Added per-account limits to model discovery and chat completions.
- Enforced server-side output-token and text-context limits.
- Added regression tests for the health endpoint, request budgets, and account rate limits.
- Removed the committed Android debug keystore and local Playwright artifacts; updated ignore rules.

## Deployment runbook

1. Confirm every required CI job passes on the latest pull-request commit; an older successful run does not validate newer changes.
2. Merge only after reviewing the final diff and checks.
3. Deploy `gateway-worker` separately to a staging Cloudflare Worker with the required Durable Object/SESSION binding, KV binding, JWT signing secret, and NVIDIA API key secrets.
4. Smoke-test health, OAuth sign-in/sign-out, model listing, a short non-sensitive chat, token caps, oversized-request rejection, and per-account throttling. Never expose live credentials in logs.
5. Promote only after staging checks pass; roll back if sign-in, model listing, or streaming fails.
6. Keep browser privacy claims accurate: web uses AES-256-GCM with a browser-profile-local Web Crypto key; Electron uses OS-backed `safeStorage`. Same-origin code can access active web data while the app is unlocked.
7. Before production release, validate signing, install/upgrade/uninstall, backup restore, data deletion, accessibility, and supported platform builds.

## Required validation before merge/deployment

1. Run gateway Worker tests and the complete client test suite.
2. Run TypeScript checks and the web production build.
3. Build Android debug from a clean runner to confirm local debug-key generation works.
4. Test Google OAuth and a real chat request against a staging Worker with the expected Cloudflare bindings.
5. Deploy the Worker separately only after review; client repository changes do not deploy Cloudflare automatically.
6. Verify that chat history deletion, memory deletion, logout, and encrypted backup restore work on web, Android, iOS, macOS, Windows, and Linux.
7. Perform a dependency audit, secret scan, and platform-specific release-signing checks.

## Follow-up review — 20 October 2026

The app now uses Supabase email/password authentication without email
verification. Teddy Bud sessions have an absolute one-hour lifetime and are not
renewed. Local encryption keys are separate per Supabase user ID on native,
Electron, and web builds. A migration path preserves existing local records as
each account is next opened. The signup and recovery passphrase verifier table
is private to the Worker service role. Worker test coverage checks signup,
legacy account migration, one-hour expiry, and rate limiting.

Verified operational gap: this source change does not alter live Supabase Auth
settings. Before deployment, apply the migration and disable Confirm Email in
Supabase Auth so signup returns a session. No auth email provider or custom
domain is needed. No production deployment was performed by this source review.

## Historical local data encryption update — 20 October 2026

The browser/Electron local-data storage review item described above has been
addressed: Electron records use OS-backed `safeStorage`; browser records use
AES-256-GCM with a non-exportable Web Crypto key. Existing plaintext browser and
Electron records are encrypted as they are first read after the storage upgrade. Native
SQLCipher and Keychain/Keystore storage remains in place. See [Security and
Privacy](SECURITY_AND_PRIVACY.md) for the current design and platform references.
