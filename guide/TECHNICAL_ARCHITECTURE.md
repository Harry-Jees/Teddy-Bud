# Technical Architecture & API Contract

## 1. System architecture

The client is a React Native application with an Electron desktop wrapper. Vite/React Native Web supports a development-only browser preview and packages the UI inside desktop apps; no standalone web product is distributed. It uses the Cloudflare Worker gateway for account operations
and authenticated AI requests. Supabase Auth manages email/password credentials;
Supabase Postgres stores account profiles and private recovery verification
records. Chats, memories, and preferences are persisted locally.

## 2. Storage and key management

- Android and macOS: account-specific SQLCipher databases; each random
  database key is stored in Keychain/Keystore.
- Electron: each account has a random AES-256-GCM key protected by Electron
  `safeStorage`; only encrypted record values are stored in IndexedDB.
- Development browser preview only: each account has a separate non-exportable Web Crypto key in IndexedDB; records use AES-256-GCM. This is not a supported public deployment target.
- Backups: encrypted `.teddybud` files use a separate passphrase-derived key.

The authenticated Supabase user ID is the local account scope and key scope.
Existing records are migrated to per-account encryption as they are opened;
native records move from the former shared SQLCipher database on a per-account
basis. Browser-preview encryption does not defend against malicious script executing in the same origin while the preview is unlocked.

## 3. Gateway API contract

- `POST /auth/signup`: create an email/password account, store a keyed
  recovery-passphrase verifier, and issue a Teddy Bud session.
- `POST /auth/login`: verify credentials and the private recovery record; issue
  a Teddy Bud session.
- `POST /auth/recover`: verify the recovery passphrase, change the Supabase
  password, and revoke that account's Teddy Bud sessions.
- `POST /auth/migrate-legacy`: upgrade a still-valid legacy Google session
  while preserving its Supabase user ID.
- `GET /auth/session`: validate a saved session before loading local data.
- `POST /auth/refresh`: always rejects renewal; sessions expire after one hour.
- `POST /auth/logout`: revoke the current server-side session.
- `GET /health`: gateway health check.
- `GET /v1/models`: authenticated AI model discovery.
- `POST /v1/chat/completions`: authenticated chat proxy to NVIDIA-hosted model endpoints.

Only the routes listed above are exposed by the public Worker dispatcher. Durable Object paths such as `/session`, `/user-sessions/*`, `/account/*`, and `/rate` are internal state operations, not public client API routes.

## 4. Authentication and session behavior

Email is an account identifier; email ownership verification is not required.
Configure Supabase Auth with **Confirm email** disabled so signup returns an
Auth token and no email delivery is required. The gateway still checks for an
RLS-protected profile and a private recovery verifier before granting access.

Teddy Bud sessions are signed bearer tokens backed by Durable Object session
records and expire one absolute hour after issue. Refresh does not renew them.
The app clears the local token and returns to sign-in at expiry. Sign-in,
signup, and recovery are rate-limited. Durable
Objects also keep per-user session indexes used to revoke sessions after
password recovery.

The Worker validates the session for `/v1/*` requests and proxies to NVIDIA;
the NVIDIA key remains a Worker secret. The `SUPABASE_SERVICE_ROLE_KEY` and
`RECOVERY_KEY_SECRET` are also server-only. The profile query uses the user's
Supabase token and RLS; the recovery table is accessed only by the Worker.

## 5. AI and privacy constraints

- All AI inference happens remotely through the gateway.
- The client prefers `openai/gpt-oss-20b` for chat when that model is present in the returned catalog; image requests prefer `meta/muse-glimmer-30b` when it advertises vision support. The client does not guarantee either model is available to every NVIDIA account and does not pin a fixed fallback list.
- Normal conversation requests ask for up to 4,096 output tokens, coding and image requests ask for 220, and the Worker applies a server-side ceiling of 2,048 output tokens. Recent chat context is capped at 80,000 characters by the client.
- The client sends the active conversation and only the memories, selected
  history, or About me content enabled by the privacy controls.
- Provider credentials never ship in the client.

See [Security and Privacy](SECURITY_AND_PRIVACY.md) for implementation limits,
email delivery constraints, migration details, and security references.
