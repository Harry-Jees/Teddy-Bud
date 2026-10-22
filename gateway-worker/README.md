# Teddy Bud Gateway Worker

This Worker is deployed at `https://teddy-bud-browser-gateway.harryjees.workers.dev`. It authenticates email/password accounts with Supabase Auth, issues revocable Teddy Bud sessions, verifies user-chosen recovery passphrases, and proxies authenticated AI requests.

## Supabase setup

1. Apply the profile migrations and [`20261020165119_add_account_recovery_verifiers.sql`](../supabase/migrations/20261020165119_add_account_recovery_verifiers.sql) from the repository root.
2. Enable Supabase Auth's Email provider and disable **Confirm email**. Email is used as an account identifier; the app does not send signup or password-reset emails. This requires no purchased domain or SMTP provider.
3. Configure Auth's password policy to require at least 6 characters. The app enforces that minimum too. Supabase Auth stores the password verifier; the app and gateway never save plaintext passwords. The app stores a keyed verifier for the recovery passphrase, never the passphrase itself or the user's password.

The recovery table has RLS enabled and grants no access to `anon` or `authenticated`. Only the gateway's server-side Supabase service-role secret can read or write it. The table stores the normalized email and an HMAC verifier, never the recovery passphrase itself. The HMAC uses a separate gateway secret. Do not expose either server secret in the client bundle.

## Gateway setup

1. Install Node.js 22 or newer and run `npm install` here.
2. Authenticate Wrangler with the Cloudflare account that owns the `harryjees.workers.dev` subdomain: `npx wrangler login`.
3. Apply the migrations above to the Supabase project configured for this app.
4. Add these secrets:

   ```powershell
   npx wrangler secret put JWT_SIGNING_SECRET
   npx wrangler secret put RECOVERY_KEY_SECRET
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

   Generate `JWT_SIGNING_SECRET` and `RECOVERY_KEY_SECRET` independently using a cryptographically secure random generator with at least 32 bytes. `SUPABASE_SERVICE_ROLE_KEY` is highly privileged: keep it only in the Worker secret store. Never use it in the app. The anon/publishable key is not a secret.
5. Set the non-secret `AUTH_REDIRECT_ORIGINS` Worker variable to the exact browser origins allowed to call the gateway, comma-separated. Include local development, for example `http://localhost:5173,http://127.0.0.1:5173`, and the deployed app origin. The Worker does not return CORS access to arbitrary origins. Native clients do not send a browser Origin header.
6. For production, use the protected GitHub Actions workflow `.github/workflows/deploy-cloudflare-ai.yml`. It stages a Worker version and checks that the `AI`, Durable Object, KV, and required secret binding names are present before directing production traffic to it. Do not use a direct production deploy until the staged bindings have been verified.

## Account and recovery flow

`POST /auth/signup` creates an email/password account in Supabase Auth, checks its RLS-protected profile, stores the keyed recovery-passphrase verifier in the private recovery table, and issues a Teddy Bud session. `POST /auth/login` verifies credentials and the private recovery record. `POST /auth/recover` verifies the recovery passphrase, changes the Supabase password through the Admin Auth API, and revokes all gateway sessions for that account. `POST /auth/migrate-legacy` upgrades a currently valid pre-password session, sets its password and recovery verifier, and keeps its Supabase user ID. `GET /auth/session` validates the saved session before the client loads local account data. Sign-in, signup, recovery, and migration attempts are rate-limited.

Users choose a recovery passphrase during account creation and enter it again to confirm. It must be 10 to 128 characters; choose a unique phrase and keep it somewhere safe. Anyone who knows the passphrase and account email can reset the password. The gateway stores only a keyed HMAC verifier, not the phrase itself. Native session tokens are stored using Keychain/Keystore; Electron uses OS secure storage; browsers use session storage. Sessions expire after one absolute hour. `/auth/refresh` does not extend them; the app clears the expired session and prompts for sign-in. Chats remain encrypted locally under separate per-account keys and scoped to the Supabase user ID. Password recovery does not decrypt or transfer chats from another device.

There is no built-in administrator recovery flow if a user loses both their
password and recovery passphrase. Supabase Auth stores password verifiers rather
than recoverable passwords. An operator can reset the account only through a
separately secured Supabase administrative process; this repository does not
implement that process, and resetting a password cannot restore local keys or
data that were lost with another device.

Existing accounts are moved only when the device still has a valid legacy Teddy Bud session. The user chooses a password and recovery passphrase in the app; the gateway validates the signed legacy session, updates that same Supabase user, and issues a password session with the unchanged user ID. This keeps that user's local chats under the same owner without a Google sign-in flow or purchased domain. The old session is time-limited (at most its remaining one-hour refresh window). If it has expired or was cleared, this app cannot prove ownership without the retired sign-in method; do not tell those users to create a new account if they need their old chats. Plan the release while users can still open the previous app/session, or provide another verified recovery process before disabling it.

Supabase's current Free plan includes 50,000 monthly active users for Auth. This is an Auth quota, not a promise that database, bandwidth, Worker, or model-provider costs remain free. Cloudflare's Free Worker tier currently stops serving requests when its daily quota is exceeded rather than billing overages; if you manually move the account to a paid plan, that billing model changes. The app sends no auth emails, so this flow does not require an SMTP provider or domain.

Chat, coding, titles, and memory suggestions route to Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`; requests containing an image are routed server-side to `@cf/qwen/qwen3.8-27b`. The `AI` binding is declared in `wrangler.toml`; both model IDs were confirmed present in the connected Cloudflare account. The native Workers AI binding does not require a provider API key.

The Free plan has one shared balance of 40 credits per UTC day: text requests cost 1 credit and image requests cost 5. The gateway reserves credits atomically in Durable Objects, refunds them for inference errors before a response is returned, and exposes the balance through authenticated `GET /v1/credits`. Clients cannot choose their own user ID or credit cost. This is a product usage cap, not a precise billing ledger; monitor Cloudflare AI usage and account spend separately.

Durable Objects store Teddy Bud sessions, per-user session indexes, burst limits, and daily credits. `/auth/refresh` rejects renewal after the one-hour session lifetime and `/auth/logout` revokes the current session. The Worker also adds crisis response guidance for selected direct phrases. This is best effort and is not a clinical screen or emergency service.

## Local checks

Run `npm test`. Use `npm run dev` for local Worker development after configuring Wrangler secrets and Durable Objects.
