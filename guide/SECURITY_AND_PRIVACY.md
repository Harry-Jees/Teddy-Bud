# Security and Privacy

This guide describes how Teddy Bud handles identity, local app data, encryption
keys, backups, and chat requests. It reflects the repository implementation and
was checked against the platform documentation linked below on 20 October 2026.

## At a glance

| Area | Design |
| --- | --- |
| Sign-in | Google OAuth through the Cloudflare gateway and Supabase Auth |
| Local account scope | The authenticated Supabase user ID (`sub`) scopes each local data record |
| Android, iOS, macOS | SQLCipher database; random 256-bit database key in platform secure storage |
| Electron desktop | Local records are encrypted using Electron `safeStorage`, backed by the operating-system credential store |
| Web | Local records use AES-256-GCM; a non-exportable Web Crypto key is stored in the browser's IndexedDB |
| Portable backup | PBKDF2-SHA-256 derives a key from the user's backup passphrase; AES-256-GCM encrypts the export |
| Cloud data | Conversations and memories are stored locally. The gateway receives only the context selected by privacy settings when a chat is sent |

## Sign-in and account identity

Google OAuth authenticates the user. The gateway validates the Supabase identity
and issues a Teddy Bud session. Local records are keyed by the verified user ID
from the session token, so switching accounts on one device reads a different
local record. The app does not use the account email as a cryptographic secret.

Supabase Auth already manages the verified email with the user identity. The
`public.user_profiles` table stores the user ID and profile name and applies row
level security. A separate account email copy or a server-side encryption salt
is not necessary for the device-local key scheme.

An email address is public identity data, and a salt is intentionally
non-secret. Combining an email and salt cannot replace a random encryption key.
Google OAuth proves account identity; it does not provide the app with a stable
secret from which to derive an encryption key. Using those values as key
material would add coupling without improving key secrecy.

## Local data encryption

Teddy Bud stores chats, memories, and privacy preferences on the device. The
native client creates a cryptographically random 256-bit database key, stores it
in Keychain/Keystore, and opens the database with SQLCipher. A platform secure
store is designed for small secrets such as cryptographic keys. Android Keystore
can make key material non-exportable; Apple Keychain provides encrypted storage
for keys and other small secrets.

Electron encrypts each local record through Electron `safeStorage`. The main
process checks that operating-system encryption is available; on Linux, it
requires a supported Secret Service backend rather than the basic-text backend.
Only ciphertext is written to the web storage layer.

Web encrypts each local record with AES-256-GCM and a fresh 96-bit IV. Its
256-bit non-exportable CryptoKey is stored in IndexedDB. The record key is used
as authenticated additional data so that ciphertext cannot be silently moved
between account records. This is browser-profile-local encryption: the key and
ciphertext are both available to that browser profile, and same-origin script
execution can use the key while the app is running. It protects persisted
database contents and copied storage files; it does not protect against a
compromised app origin, browser extension, or an already unlocked session.

When the web storage schema upgrades, existing plaintext web or Electron
records are encrypted the first time each record is read. If the browser's site data is cleared, both
the local key and local data are removed. WebCrypto or IndexedDB errors fail the
storage operation; the client does not fall back to writing plaintext.

## Backups and moving to another device

Local encryption keys are device or browser-profile specific. Signing into the
same Google account on another device does not transfer the local database key
or conversation history. To move data, export an encrypted `.teddybud` backup
and import it on the other device while signed in to the same account.

Backups contain a random 128-bit salt and a random 96-bit AES-GCM IV. PBKDF2
with SHA-256 and 310,000 iterations derives the AES-256-GCM key from the
user-chosen backup passphrase. The encrypted payload also records its account
owner, which is checked during import. Keep the passphrase separately: it is
not recoverable by Teddy Bud or by Google sign-in. A backup salt is public
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
- Treat browser same-origin script execution as able to read active local data; deploy the web app over HTTPS and keep dependencies and content security controls current.

## References

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) — random key generation, separation of keys and data, and key storage.
- [OWASP Mobile Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html) — encrypt sensitive local data and protect keys using platform storage.
- [Android Keystore system](https://developer.android.com/privacy-and-security/keystore) — non-exportable keys and hardware-backed protection where available.
- [Apple Keychain Services](https://developer.apple.com/documentation/security/keychain_services) — encrypted storage for small secrets and cryptographic keys.
- [Supabase Auth users](https://supabase.com/docs/guides/auth/users) — user identity, user IDs, email, and auth metadata.
- [Supabase managing user data](https://supabase.com/docs/guides/auth/managing-user-data) — application profile tables, foreign keys to `auth.users`, and row-level security.
- [Web Crypto `CryptoKey.extractable`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/extractable) — meaning and limits of non-exportable browser keys.
- [Web Crypto `SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) — browser cryptographic operations and IndexedDB key storage.
