# OpenRouter migration and release runbook

## Current migration state

The client and Worker use OpenRouter. The Worker allowlist is the source of truth for models that may be advertised or requested. The model catalog must never expose models that the chat endpoint rejects.

## Automated checks

- gateway-worker tests cover approved model filtering, chat forwarding, auth, rate limits, token ceilings, and health reporting.
- The regular CI workflow runs client tests/type checks and Worker tests.
- .github/workflows/deploy-openrouter.yml provides a manual, production-gated deployment path. It checks required remote secret names before deployment, verifies /health and the unauthenticated model-catalog guard after deployment, and automatically rolls back to the prior active version if deployment verification fails.
- Never print, commit, or put provider credentials in client code or build artifacts.

## Required GitHub Actions configuration

Add these repository Actions secrets before running the production deployment workflow:

- CLOUDFLARE_API_TOKEN — token with permission to deploy and inspect the teddy-bud-browser-gateway Worker and its versions/secrets.
- CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID containing the Worker.

The following values must already exist as Cloudflare Worker secrets. The workflow checks their names only and never reads or prints their values:

- OPENROUTER_API_KEY
- JWT_SIGNING_SECRET
- RECOVERY_KEY_SECRET
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Do not put the secret values in this file or the repository. If the remote secret check fails, stop and configure the missing binding in Cloudflare before retrying.

## Safe deployment procedure

1. Merge the migration PR after all CI checks pass.
2. Configure the GitHub Actions production environment with required reviewers if approval is desired.
3. Open Actions → Deploy OpenRouter Worker → Run workflow on main.
4. The workflow checks the required secret names, records the currently active Worker version, deploys through Wrangler, and verifies the health endpoint and auth guard.
5. If verification fails, the workflow rolls back to the recorded prior active version and verifies health again.
6. Treat the release as complete only when the workflow succeeds and the app completes a real authenticated chat and vision smoke test.

The production workflow intentionally does not create or modify Cloudflare secret values. The secret values remain managed in Cloudflare; the deploy workflow requires only the Cloudflare API token and account ID in GitHub Actions.

## Operational checks

- Health must return HTTP 200 with status: ready and provider_configured: true.
- /v1/models must reject requests without a valid Teddy Bud session.
- Authenticated model discovery should list only the allowlisted free models.
- A real client test must confirm normal chat, vision, memory extraction, streaming on browser preview, and clear error handling.
- OpenRouter web search is optional and may incur separate upstream charges. Keep it disabled unless the user explicitly enables it and the feature is intentionally tested.
