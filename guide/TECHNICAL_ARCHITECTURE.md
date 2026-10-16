# Technical Architecture & API Contract

## 1. System Architecture
The client app is built in React Native. It operates as a thin, secure client connecting to a remote Gateway (Cloudflare Worker) which proxies to NVIDIA-hosted AI APIs.

## 2. Tech Stack
- **Frontend**: React Native (with `react-native-windows` for desktop support)
- **Local Storage**: Account-scoped SQLCipher database on supported native builds; IndexedDB on web
- **Key Management**: Native secure storage for native database keys (Android Keystore / iOS Keychain)

## 3. Gateway Boundary (API Contract)
The client relies entirely on an external Cloudflare Worker gateway via HTTPS. Fake transports/mocks should only be used in unit tests, not for live capabilities.

### External Endpoints
- `POST /auth/signup`: Create a Supabase email/password account and send an email confirmation link.
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
Web and native clients create accounts and sign in with email and password.
Supabase Auth stores passwords and enforces email confirmation; Resend delivers
the confirmation emails through Supabase's custom SMTP configuration.
`public.user_profiles` mirrors each `auth.users.id` using an insert trigger and
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
JWT subject. On native builds, SQLCipher encrypts the database and the database
key is stored in platform secure storage. Browser storage is not encrypted by
the app; users should protect their browser profile and clear local data when
needed. Saved memories are sent with a chat request only when the user enables
memory sharing.

The web client uses the browser's IndexedDB API for local persistence; it does
not require OPFS or cross-origin-isolation headers.

The browser gateway Worker is deployed as
`https://teddy-bud-browser-gateway.harryjees.workers.dev`. Its Access login
requires a custom hostname protected by a Cloudflare Access application.