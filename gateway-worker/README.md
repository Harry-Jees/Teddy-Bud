# Teddy Bud Gateway Worker

This is a separate Cloudflare Worker project, deployed at
`https://teddy-bud-browser-gateway.harryjees.workers.dev`. It delegates
email/password and Google OAuth authentication to Supabase Auth, issues
one-hour server-side sessions, supports native Ed25519 registration/
verification, an optional Cloudflare Access redirect, and proxies authenticated
NVIDIA model/chat requests. It does not deploy automatically or replace the
original Worker.

## Configure and deploy

1. Install Node.js 22 or newer and run `npm install` in this directory.
2. Authenticate Wrangler with the Cloudflare account that owns the
   `harryjees.workers.dev` subdomain: `npx wrangler login`.
3. A dedicated KV namespace and a Durable Objects binding for strongly
   consistent server-side session records are configured in `wrangler.toml`.
   Do not replace the KV namespace with the original gateway's namespace.

4. Create a Supabase project. Apply
   [`supabase/migrations/20261014165000_create_user_profiles.sql`](../supabase/migrations/20261014165000_create_user_profiles.sql)
   and [`supabase/migrations/20261016123000_add_full_name_to_user_profiles.sql`](../supabase/migrations/20261016123000_add_full_name_to_user_profiles.sql)
   from the repository root using the Supabase SQL Editor, or apply them with
   `supabase db push` after linking the correct project. They create
   `public.user_profiles`, enables row-level security, creates a profile for
   existing and new Auth users, and allows an authenticated user to read only
   the row whose `user_id` matches `auth.uid()`.
5. To support email/password signup, enable email confirmations and configure
   the signup Confirmation email template to include the one-time code, for
   example `{{ .Token }}`. The Supabase built-in mailer is restricted to
   authorized team addresses and low-volume testing; public email signup needs
   a mail provider and verified sender domain. If using Resend as Supabase's
   custom SMTP provider:
   - SMTP host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (STARTTLS)
   - Username: `resend`
   - Password: a Resend API key
   - Sender address: an address on a domain verified in Resend

   Keep the Resend API key in Supabase's SMTP settings only. The Worker does
   not send email directly; Supabase Auth creates and verifies credentials
   and asks the configured SMTP provider to deliver confirmation emails.

6. To enable no-email/no-SMS Google sign-in, enable Google under Supabase
   Authentication → Providers. Create a Google Web OAuth client and set its
   authorized redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`. Enter that client ID
   and secret in Supabase's Google provider settings. In Supabase Auth URL
   Configuration, allow `teddybud://auth/callback`,
   `http://localhost:3040/auth/callback`, and the deployed web callback URL.
   OAuth authorization uses PKCE; the Worker exchanges the short-lived code
   server-side and consumes each pending state once.

7. Configure the gateway:

   ```powershell
   npx wrangler secret put JWT_SIGNING_SECRET
   npx wrangler secret put NVIDIA_KEY_1
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   ```

   Use the Supabase project URL and publishable/anon key; never use a
   `service_role` or secret key. Generate the JWT secret locally
   (`openssl rand -base64 48`). Do not put keys in source control.
8. For production web Google sign-in, configure the non-secret Worker variable
   `AUTH_REDIRECT_ORIGINS` as a comma-separated list of approved web origins,
   such as `https://your-app.vercel.app`. Localhost callbacks and the native
   `teddybud://auth/callback` URI are handled separately. (Optional) For the
   separate Cloudflare Access login, also configure `ACCESS_ISSUER` and
   `ACCESS_AUD`. Attach the Worker to a custom hostname.
   Create a Cloudflare Access
   self-hosted application on that hostname, protect only `/auth/login`, and
   enable One-time PIN with the allowed email identities. Access must inject
   `Cf-Access-Jwt-Assertion` for requests that reach the Worker. A `workers.dev`
   hostname alone is not an Access-protected login endpoint.
9. Deploy Worker updates with `npm run deploy`.

The new Worker is intentionally named `teddy-bud-browser-gateway`; deployment
does not overwrite `teddy-bud-gateway`. Supabase Auth stores account credentials
and enforces email confirmation; Supabase sends those emails through Resend
SMTP. Each Auth UUID and signup name are mirrored to `public.user_profiles` by a
database trigger. Email and password credentials remain managed by Supabase
Auth; the Worker never stores the password. On confirmation and password login, the Worker presents the user's
Supabase access token to the profile REST endpoint; RLS ensures that the user
can only see their own matching `user_id`. The Worker issues a Teddy Bud
one-hour JWT only after that cross-check succeeds. Passwords and Supabase
access tokens are not persisted by the Worker. Durable Objects store only
Teddy Bud sessions and rate limits.
`/auth/refresh` renews an active session and `/auth/logout` revokes it
immediately. Signup codes are verified at `/auth/verify-signup-otp` and can be
resent at `/auth/resend-signup-otp`. Google OAuth starts at `/auth/google/start`
and completes at `/auth/google/complete`; the pending PKCE verifier is held in
a short-lived Durable Object record. Authenticated model and chat requests are
proxied from Cloudflare to NVIDIA; the NVIDIA key remains a Worker secret and
is never sent to clients.

## Local verification

Run `npm test`. For a local Worker, use `npm run dev` after configuring the
local secrets and a local KV namespace with Wrangler.
