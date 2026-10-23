# Cloudflare Workers AI migration and release runbook

## Current migration state

The production Worker was deployed on 2026-10-23 as version `53e016c3-395f-44ad-9e1e-5c206710c27e`. It routes ordinary text to Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash` and image-containing requests to `@cf/qwen/qwen3.8-27b`. The deployment passed Worker regression tests, secret/binding preflight, production health checks, and auth-guard smoke tests. The `AI` binding is declared in `gateway-worker/wrangler.toml`; the client/gateway route no longer relies on the previous OpenRouter path.

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
- Text requests cost 1 credit; image requests cost 1; daily cap is 40 credits, resetting at 00:00 UTC.
- Run authenticated client smoke tests for normal chat, image upload/analysis, memory extraction, browser streaming, and clear quota/error handling. Pro has 7 personalities and Premium has 10, both labelled coming soon and unavailable for selection in the Free release. Enterprise local-model routing is documented as a future capability.
- Cloudflare Workers AI is billable beyond any applicable allowance. Credits are a product limit, not an exact cost ledger; monitor account usage and spend separately.

- Enterprise mode must route text and image requests only to the configured company-managed OpenAI-compatible endpoint; incomplete enterprise configuration must fail closed without falling back to Cloudflare Workers AI.
- Never expose enterprise model API keys to client code, logs, or user-controlled request fields.
