# Cloudflare Workers AI migration and release runbook

## Current migration state

The migration is merged to `main` and deployed to the Cloudflare Worker as version `6ceee0eb-cc75-4cfc-b6cf-a6cb42ea7765` (deployment `5bfec88c-f20e-4e57-aae1-687395e81179`). Ordinary text routes to `@cf/zai-org/glm-4.7-flash`; image-containing requests route to `@cf/qwen/qwen3.8-27b`. The deployed version includes the `AI` binding and required auth/Supabase secret binding names. Direct Cloudflare API smoke requests to both models returned HTTP 200. Full authenticated public-Worker end-to-end verification of quota exhaustion/refunds is still outstanding.

## Automated checks

- Gateway tests cover Cloudflare model routing, daily credit accounting, auth, input limits, and health.
- CI runs client tests/type checks and gateway tests.
- `.github/workflows/deploy-cloudflare-ai.yml` is the manual, production-gated deployment path. It checks required secret names, records the active Worker version for rollback, runs regression tests, deploys through Wrangler, and checks health and authentication guards.
- Never print, commit, or put provider credentials in client code or build artifacts.

## Required GitHub Actions configuration

Add repository Actions secrets before running the production deployment workflow:

- `CLOUDFLARE_API_TOKEN` — token with permission to deploy and inspect the `teddy-bud-browser-gateway` Worker and its versions/secrets.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID containing the Worker.

These existing Cloudflare Worker secrets must remain available:

- `JWT_SIGNING_SECRET`
- `RECOVERY_KEY_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The native Workers AI binding does not require an OpenRouter API key. Do not remove or overwrite existing secrets during deployment setup. The workflow checks names only and must never read or print values.

## Safe deployment procedure

1. Keep production on its current healthy version until CI passes and the staged migration version is confirmed to include all required secret bindings.
2. Confirm GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured.
3. Open Actions → Deploy Cloudflare AI Worker → Run workflow on the migration branch only after the preflight is ready.
4. The workflow checks secret names, records the active version, runs Worker tests, deploys, and verifies health plus the unauthenticated model-catalog guard.
5. If deployment verification fails, automatically roll back to the previously active version and verify health again.
6. Consider release complete only after a real authenticated text and vision request succeeds and the daily-credit balance behaves correctly.

## Operational checks

- `GET /health` must return HTTP 200 with `status: ready`, `provider_configured: true`, and `provider: cloudflare-workers-ai`.
- `GET /v1/models` must reject unauthenticated requests with HTTP 401.
- Authenticated model discovery must list only the two approved Cloudflare model IDs.
- `GET /v1/credits` must return the signed-in user's daily balance.
- Text requests cost 1 credit; image requests cost 5; daily cap is 40 credits, resetting at 00:00 UTC.
- Run authenticated client smoke tests for normal chat, image analysis, memory extraction, browser streaming, and clear quota/error handling.
- Cloudflare Workers AI is billable beyond any applicable allowance. Credits are a product limit, not an exact cost ledger; monitor account usage and spend separately.
