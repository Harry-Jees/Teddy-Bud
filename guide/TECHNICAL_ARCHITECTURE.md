# Technical Architecture & API Contract

## 1. System Architecture
The client app is built in React Native. It operates as a thin, secure client connecting to a remote Gateway (Cloudflare Worker) which proxies to NVIDIA-hosted AI APIs.

## 2. Tech Stack
- **Frontend**: React Native with React Native Web and an Electron desktop wrapper
- **Local Storage**: Account-scoped SQLCipher on native builds; encrypted IndexedDB records on web and Electron
- **Key Management**: Native Keychain/Keystore, Electron `safeStorage`, or a browser-profile-local non-exportable Web Crypto key

## 3. Gateway Boundary (API Contract)
The client relies entirely on an external Cloudflare Worker gateway via HTTPS. Fake transports/mocks should only be used in unit tests, not for live capabilities.

### External Endpoints
- `POST /auth/signup`: Create a Supabase email/password account and send a verification code.
- `POST /auth/verify-signup-otp`: Verify an email signup code and create a Teddy Bud session.
- `POST /auth/resend-signup-otp`: Resend an email signup code.
- `POST /auth/verify-email`: Validate a confirmed Supabase access token and create a Teddy Bud session.
- `POST /auth/login`: Sign in to Supabase with email and password, then create a Teddy Bud session.
- `GET /auth/login`: Optional Cloudflare Access redirect flow.
- `POST /auth/refresh`: Renews an active one-hour session.
- `POST /auth/logout`: Revokes the current server-side session.
- `POST /auth/register`: Device registration.
- `POST /auth/verify`: Device verification.
- `GET /health`: Gateway health check.
- `GET /v1/models`: AI model discovery.
- `POST /v1/chat/completions`: Authenticated chat proxy to NVIDIA.

## 4. AI Constraints
- **Cloud-only AI**: All AI inference happens remotely. No local inference tools are permitted.
- The client must not infer gateway routes, response schemas, model IDs, token semantics, or deployment behavior that have not been explicitly supplied by the gateway contract.

## 5. Browser and native authentication
Web and native clients can create accounts with a name, email, and password,
then verify the email with a signup OTP before signing in. Supabase Auth stores
credentials and enforces email confirmation; its Confirmation email template
must include `{{ .Token }}`. Email delivery uses the configured Supabase mailer.
Alternatively, Google OAuth signs users in without requiring email or SMS
delivery. The gateway starts an OAuth PKCE flow, stores the verifier and state
temporarily in Durable Objects, exchanges the returned code with Supabase Auth,
and checks the user's profile before issuing a Teddy Bud session. The Google
client secret stays in Supabase and is never sent to the app.
`public.user_profiles` stores the signup name and mirrors each `auth.users.id` using an insert trigger and
has row-level security so users can select only their own row. The Worker
validates the Supabase identity and, using that user's Supabase access token,
checks the RLS-protected profile row before issuing its own bearer token for
chat. No Supabase service-role key is used by the Worker.
Browser JWTs are kept in `sessionStorage` and memory; native JWTs are kept in
platform secure storage. Session records are stored in Durable Objects with a
one-hour idle timeout. Refresh extends active sessions; logout revokes them
immediately. The Worker also exposes an optional Cloudflare Access redirect
endpoint and legacy device registration/verification endpoints.
All `/v1/*` requests require a valid bearer JWT and are proxied by Cloudflare;
the NVIDIA API key remains a Worker secret and is never sent to the client.

Chat history, manually saved memories, and their preferences persist locally per
JWT subject. Native builds use SQLCipher with the database key in platform
secure storage. Electron encrypts records through OS-backed Electron
`safeStorage`. The web client uses AES-256-GCM with a non-exportable CryptoKey
stored in IndexedDB; this is device/profile-local protection and does not prevent
same-origin code from accessing data while the app runs. Existing plaintext
web/Electron records are encrypted on first read after the storage upgrade. The web client
fails closed if encryption is unavailable. Saved memories are sent with a chat
request only when the user enables memory sharing.

Local encryption keys are not derived from a Google email or OAuth token and
are not synchronized through Supabase. Supabase Auth manages the account email;
the application profile table associates data with the Supabase user ID. The
encrypted backup feature is the supported cross-device transfer path and uses
its own passphrase-derived key. See [Security and Privacy](SECURITY_AND_PRIVACY.md)
for the design and references.

The web client uses IndexedDB for local persistence; it does not require OPFS
or cross-origin-isolation headers.

The browser gateway Worker is deployed as
`https://teddy-bud-browser-gateway.harryjees.workers.dev`. Its Access login
requires a custom hostname protected by a Cloudflare Access application.
