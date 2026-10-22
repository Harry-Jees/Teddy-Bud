# Cloudflare AI + PhonePe billing migration

## Current migration target

- Text conversation model: `@cf/zai-org/glm-4.7-flash` (text-only, lower-cost routing).
- Image understanding model: `@cf/qwen/qwen3.8-27b` (vision-capable).
- Initial Free plan: 40 credits per user per UTC day; one text message or one image message costs one credit.
- Pro (7 personalities) and Premium (10 personalities) are coming soon; no checkout is enabled in the initial release.
- Industrial / Enterprise local inference is a planned deployment mode; see `docs/PLANS_AND_ENTERPRISE.md`.
- Inference is routed through the gateway's Cloudflare Workers AI binding; the client must never receive provider credentials.
- PhonePe Payment Gateway is the intended checkout provider. Do not enable paid entitlements until merchant onboarding, signed webhook verification, idempotency, refunds and renewal events are implemented and tested.

## Required Cloudflare setup

1. Confirm the account's Workers AI free allowance and model pricing before launch. Any free daily allocation is shared by the Cloudflare account, not per Teddy Bud user; inference above the allowance may incur charges.
2. Configure the `AI` binding in `gateway-worker/wrangler.toml`.
3. Monitor actual Workers AI model usage and account-level spend; the daily free allocation is shared by the Cloudflare account, not per Teddy Bud user.
4. Deploy to a staging Worker first and run integration tests before production traffic is switched.

## Usage ledger and plans

The entitlement service should be independent of PhonePe and the model provider. For every inference, record:

- authenticated Supabase user ID and request ID (idempotent);
- model ID, timestamp, input/output token usage where available, and the best available actual/estimated provider cost;
- the plan/entitlement snapshot and usage reservation/reconciliation status.

Reserve an upper-bound amount before inference, reconcile on completion, and release the reservation on a confirmed provider failure. Enforce per-user daily and monthly budgets, maximum context/output size, and request burst limits server-side. Do not treat a message count as a cost measurement.

For pricing, calculate the included inference budget plus allocated infrastructure and payment fees, then apply a target gross margin and abuse/refund buffer. Publish limits only after real traffic measurements establish a safe allowance.

## PhonePe production prerequisites

Payment integration is deferred for the initial Free-only release. Do not add checkout or paid entitlements until plan demand and actual model costs have been measured. The requirements below are a future checklist, not implemented functionality.

Do not commit credentials. The following must be provisioned in Cloudflare secrets after merchant onboarding:

- PhonePe merchant/client identifier(s) as specified by the approved integration;
- PhonePe client secret / signing secret;
- environment-specific API host and webhook configuration;
- a webhook verification secret or signing key as required by PhonePe's current API version.

Implementation requirements before launch:

- Create checkout orders server-side with a unique internal order ID and server-defined INR amount.
- Verify payment status server-to-server and verify webhook signatures.
- Make webhook processing idempotent; never trust a client redirect, screenshot, or client-submitted amount.
- Handle success, failure, cancellation, refunds, subscription renewals and expired mandates.
- Persist payment events and entitlement transitions in durable storage; do not use in-memory state.
- Keep PhonePe calls behind a provider interface so another gateway can be added without changing plan/usage logic.

## Rollout checklist

- [ ] Replace all OpenRouter-specific model discovery and request assumptions.
- [ ] Normalize Cloudflare streaming chunks into the chat protocol used by web, Android and desktop.
- [ ] Add automated tests for normal replies, SSE streaming, image input, timeout/error handling and fallback.
- [ ] Implement durable per-user usage ledger and budget reservation/reconciliation.
- [ ] Implement PhonePe checkout + signed webhooks + subscription/mandate lifecycle.
- [ ] Add migrations and tests for plans, payments, usage events and idempotency.
- [ ] Run worker tests and client typecheck/build; deploy staging; smoke-test Android and web before production.
