# Teddy Bud — Architecture, Security and Delivery Audit

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

### Medium — Android release hardening
Release minification is disabled and versionCode/versionName are static. Before Play Store delivery, review R8/ProGuard compatibility, increment versions automatically, validate release signing inputs, and test a signed release build. Do not commit release keystores.

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

## Required validation before merge/deployment

1. Run gateway Worker tests and the complete client test suite.
2. Run TypeScript checks and the web production build.
3. Build Android debug from a clean runner to confirm local debug-key generation works.
4. Test Google OAuth and a real chat request against a staging Worker with the expected Cloudflare bindings.
5. Deploy the Worker separately only after review; client repository changes do not deploy Cloudflare automatically.
6. Verify that chat history deletion, memory deletion, logout, and encrypted backup restore work on web, Android, iOS, macOS, Windows, and Linux.
7. Perform a dependency audit, secret scan, and platform-specific release-signing checks.
