# Remaining work

## Finish the Cloudflare Worker migration

- Production is currently on the last healthy Worker version. Keep it there until the migration version has all required secret bindings.
- The staged OpenRouter version `9d988b4a-0f6e-4a7e-81dc-ac10c7dd274f` was uploaded for inspection but its version metadata did not list the existing secret bindings. Do not deploy it yet.
- Resolve why Wrangler's staged upload is not inheriting the existing Worker secrets. The values are already stored as Cloudflare Worker secrets; never print them or commit them. If necessary, set them again through Wrangler's protected interactive secret workflow, then stage and inspect the version.
- Required runtime secret bindings include `OPENROUTER_API_KEY`, `JWT_SIGNING_SECRET`, `RECOVERY_KEY_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Confirm the deployed version exposes all required bindings by name while values remain hidden.
- Deploy the verified version with Wrangler. Check `/health` reports `ready` and `provider_configured: true`, then perform safe smoke checks for the model catalog and authentication without exposing credentials or changing user data.
- If verification fails, roll back to the last healthy Worker version and confirm `/health` is healthy.

## Finish the repository changes

- Review the committed migration and client changes for any unfinished follow-up work.
- Run the project's existing checks when requested or before a release, and fix any failures.
- Keep local Node.js and Wrangler artifacts out of Git; `.tools/` is ignored.
