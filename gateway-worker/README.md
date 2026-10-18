# Teddy Bud Gateway Worker

This is a separate Cloudflare Worker project, deployed at
`https://teddy-bud-browser-gateway.harryjees.workers.dev`. It supports Google
OAuth as the only account sign-in method, issues one-hour server-side sessions,
and proxies authenticated NVIDIA model/chat requests. It does not deploy
automatically or replace the original Worker.

## Configure and deploy

1. Install Node.js 22 or newer and run `npm install` in this directory.
2. Authenticate Wrangler with the Cloudflare account that owns the
   `harryjees.workers.dev` subdomain: `npx wrangler login`.
3. The Durable Objects binding for strongly consistent server-side session
   records is configured in `wrangler.toml`.

4. Create a Supabase project. Apply
   [`supabase/migrations/20261014165000_create_user_profiles.sql`](../supabase/migrations/20261014165000_create_user_profiles.sql)
   and [`supabase/migrations/20261016123000_add_full_name_to_user_profiles.sql`](../supabase/migrations/20261016123000_add_full_name_to_user_profiles.sql)
   from the repository root using the Supabase SQL Editor, or apply them with
   `supabase db push` after linking the correct project. They create
   `public.user_profiles`, enables row-level security, creates a profile for
   existing and new Auth users, and allows an authenticated user to read only
   the row whose `user_id` matches `auth.uid()`.
5. Under Supabase Authentication → Providers, enable Google and disable the
   Email provider. Google OAuth is the only supported sign-in and verification
   route. Create a Google Web OAuth client and set its authorized redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`. Enter that client ID
   and secret in Supabase's Google provider settings. In Supabase Auth URL
   Configuration, allow `teddybud://auth/callback`,
   `http://localhost:5173/auth/callback`,
   `http://127.0.0.1:5173/auth/callback`, and the deployed web callback URL.
   OAuth authorization uses PKCE; the Worker exchanges the short-lived code
   server-side, verifies Google's provider identity, and consumes each pending
   state once.

6. Configure the gateway:

   ```powershell
   npx wrangler secret put JWT_SIGNING_SECRET
   npx wrangler secret put NVIDIA_KEY_1
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   ```

   Use the Supabase project URL and publishable/anon key; never use a
   `service_role` or secret key. Generate the JWT secret locally
   (`openssl rand -base64 48`). Do not put keys in source control.
7. For production web Google sign-in, configure the non-secret Worker variable
   `AUTH_REDIRECT_ORIGINS` as a comma-separated list of approved web origins,
   such as `https://your-app.vercel.app`. Localhost callbacks and the native
   `teddybud://auth/callback` URI are handled separately.
8. Deploy Worker updates with `npm run deploy`.

The new Worker is intentionally named `teddy-bud-browser-gateway`; deployment
does not overwrite `teddy-bud-gateway`. Supabase creates Google identities and
the database trigger mirrors each Auth UUID into `public.user_profiles`. The
Worker validates the Google OAuth response, then checks the matching profile
with the user's Supabase access token; RLS ensures that the user can only see
their own `user_id`. The Worker issues a Teddy Bud one-hour JWT only after that
cross-check succeeds. Supabase access tokens are not persisted by the Worker.
Durable Objects store Teddy Bud sessions and rate limits.
`/auth/google/start` and `/auth/google/complete` are the only account
authentication endpoints; the pending PKCE verifier is held in a short-lived
Durable Object record. `/auth/refresh` renews an active session and
`/auth/logout` revokes it immediately. Authenticated model and chat requests
are proxied from Cloudflare to NVIDIA; the NVIDIA key remains a Worker secret
and is never sent to clients. Before forwarding a completion, the Worker checks
the three most recent user messages for selected direct crisis phrases and adds
safety response guidance when one is detected. This is a best-effort safeguard,
not a clinical screen or emergency service; it may miss risk or react to quoted
text.

## Local verification

Run `npm test`. For a local Worker, use `npm run dev` after configuring the
local secrets and Durable Objects with Wrangler.
