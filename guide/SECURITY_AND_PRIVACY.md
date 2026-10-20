# Security and Privacy

This guide describes how Teddy Bud handles identity, local app data, encryption
keys, backups, and chat requests. It reflects the repository implementation and
was checked against the platform documentation linked below on 20 October 2026.

## At a glance

| Area | Design |
| --- | --- |
| Sign-in | Email/password through the Cloudflare gateway and Supabase Auth; user-chosen recovery passphrase for password resets |
| Local account scope | Each local data record is keyed by the authenticated Supabase user ID (`sub`) |
| Android and macOS native builds | SQLCipher database; random 256-bit key in platform secure storage |
| Electron desktop | Local records are encrypted using Electron `safeStorage`, backed by the operating-system credential store |
| Standalone web app | Not supported or distributed; no hosted browser deployment is intended |
| Portable backup | PBKDF2-SHA-256 derives a key from the user's backup passphrase; AES-256-GCM encrypts the export |
| Cloud data | Conversations and memories are stored locally. The gateway receives only the context selected by privacy settings when a chat is sent |

## Sign-in and account identity

Email/password credentials are verified by Supabase Auth through the Cloudflare
gateway. Email is an account identifier; the app does not require email
verification. The gateway issues a signed Teddy Bud session backed by a
server-side session record. It expires after one absolute hour; refresh cannot
extend it. The app clears the
session and asks the user to sign in again at expiry. Local records and
encryption keys are scoped by the authenticated Supabase user ID (`sub`), so a
different account on the same device opens separate encrypted storage. The app
does not use the account email as a cryptographic secret.

Supabase Auth manages account credentials and email identity. The
`public.user_profiles` table stores the user ID and profile name and applies row
level security. The private `account_recovery_verifiers` table stores the
normalized email and a keyed HMAC verifier for the user-chosen recovery
passphrase. The phrase itself is not stored. The gateway needs a separate
`RECOVERY_KEY_SECRET` to verify it. Configure Supabase Auth with email
confirmation disabled; sign-in still requires a valid password and matching
private recovery record.

An email address is public identity data, and a salt is intentionally
non-secret. Combining an email and salt cannot replace a random encryption key.
The password and recovery passphrase are account credentials, not local
database encryption keys. The recovery passphrase can reset the account
password but cannot decrypt local data on a different device.

There is no in-app administrator recovery flow for someone who loses both the
password and recovery passphrase. Supabase Auth stores its password verifier,
not a retrievable plaintext password; the private HMAC recovery verifier cannot
reveal the phrase. A trusted operator could reset the Supabase Auth password
through a separately secured administrative process, but that process is not
implemented in this repository and would still not recover the user's local
encryption keys or chats from a different device.

## Local data encryption

Teddy Bud stores chats, memories, and privacy preferences on the device. The
native client creates a cryptographically random 256-bit database key per
account, stores each key in Keychain/Keystore, and opens that account's own
SQLCipher database. A platform secure store is designed for small secrets such
as cryptographic keys. Android Keystore can make key material non-exportable;
Apple Keychain provides encrypted storage for keys and other small secrets.

Electron encrypts each local record with AES-256-GCM using a random key per
account, then protects that key with Electron `safeStorage`. The main process
checks that operating-system encryption is available; on Linux, it requires a
supported Secret Service backend rather than the basic-text backend. Only
ciphertext is written to the web storage layer.

Web encrypts each local record with AES-256-GCM, a fresh 96-bit IV, and a
separate non-exportable CryptoKey for each account, stored in IndexedDB. This is browser-profile-local
encryption: the key and ciphertext are both available to that browser profile,
and same-origin script execution can use the key while the app is running. It
protects persisted database contents and copied storage files; it does not
protect against a compromised app origin, browser extension, or an already
unlocked session. Browser sessions are held in `sessionStorage`, which is also
available to same-origin JavaScript.

Existing account records are migrated to their account-specific keys on first
read. Existing native records are moved from the former shared SQLCipher
database one account at a time when that account next opens. This preserves
the existing account's chat owner ID. If the browser's site data is cleared, both
the local key and local data are removed. WebCrypto or IndexedDB errors fail the
storage operation; the client does not fall back to writing plaintext.

## Backups and moving to another device

Local encryption keys are device or browser-profile specific. Signing into the
same account on another device does not transfer the local database key
or conversation history. To move data, export an encrypted `.teddybud` backup
and import it on the other device while signed in to the same account.

Backups contain a random 128-bit salt and a random 96-bit AES-GCM IV. PBKDF2
with SHA-256 and 310,000 iterations derives the AES-256-GCM key from the
user-chosen backup passphrase. The encrypted payload also records its account
owner, which is checked during import. Keep the passphrase separately: it is
not recoverable by Teddy Bud or by account sign-in. A backup salt is public
cryptographic metadata, not a stored account secret, and is included in the
backup envelope so the passphrase can derive the same key during restore.

## Data sent to the AI provider

Chat requests go through the Cloudflare gateway to the configured NVIDIA-hosted
model API. Privacy controls determine whether memories, selected chat excerpts,
and the About me note are added to a request. The gateway holds provider
credentials; those credentials are not shipped in the client. Consult the
privacy controls before sending sensitive information.

## Operational guidance

- Keep operating-system and browser accounts protected with device access controls.
- Use the in-app clear-data control before handing a device or browser profile to someone else.
- Keep encrypted backups and their passphrases in separate protected locations.
- Do not put OAuth, Supabase service-role, or model-provider secrets in client code.
- Treat the Electron renderer and its dependencies as security-sensitive; keep the packaged app and dependencies current and avoid loading untrusted remote content.

## References

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) — random key generation, separation of keys and data, and key storage.
- [OWASP Mobile Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html) — encrypt sensitive local data and protect keys using platform storage.
- [Android Keystore system](https://developer.android.com/privacy-and-security/keystore) — non-exportable keys and hardware-backed protection where available.
- [Apple Keychain Services](https://developer.apple.com/documentation/security/keychain_services) — encrypted storage for small secrets and cryptographic keys.
- [Supabase Auth users](https://supabase.com/docs/guides/auth/users) — user identity, user IDs, email, and auth metadata.
- [Supabase managing user data](https://supabase.com/docs/guides/auth/managing-user-data) — application profile tables, foreign keys to `auth.users`, and row-level security.
- [Web Crypto `CryptoKey.extractable`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/extractable) — meaning and limits of non-exportable browser keys.
- [Web Crypto `SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) — browser cryptographic operations and IndexedDB key storage.
