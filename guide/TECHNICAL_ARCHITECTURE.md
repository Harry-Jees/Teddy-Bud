# Technical Architecture & API Contract

## 1. System architecture

The client is a React Native application with React Native Web and an Electron
desktop wrapper. It uses the Cloudflare Worker gateway for account operations
and authenticated AI requests. Supabase Auth manages email/password credentials;
Supabase Postgres stores account profiles and private recovery verification
records. Chats, memories, and preferences are persisted locally.

## 2. Storage and key management

- Android, iOS, and macOS: account-specific SQLCipher databases; each random
  database key is stored in Keychain/Keystore.
- Electron: each account has a random AES-256-GCM key protected by Electron
  `safeStorage`; only encrypted record values are stored in IndexedDB.
- Web: each account has a separate non-exportable Web Crypto key in IndexedDB;
  records use AES-256-GCM.
- Backups: encrypted `.teddybud` files use a separate passphrase-derived key.

The authenticated Supabase user ID is the local account scope and key scope.
Existing records are migrated to per-account encryption as they are opened;
native records move from the former shared SQLCipher database on a per-account
basis. Web encryption protects local files at rest but does not defend against
malicious script executing in the same origin while the app is unlocked.

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
- `POST /auth/register` and `POST /auth/verify`: device registration/verification
  endpoints retained for gateway compatibility.
- `GET /health`: gateway health check.
- `GET /v1/models`: authenticated AI model discovery.
- `POST /v1/chat/completions`: authenticated chat proxy to NVIDIA.

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
- The client sends the active conversation and only the memories, selected
  history, or About me content enabled by the privacy controls.
- Provider credentials never ship in the client.

See [Security and Privacy](SECURITY_AND_PRIVACY.md) for implementation limits,
email delivery constraints, migration details, and security references.
