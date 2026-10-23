# Cloudflare Workers AI launch and future PhonePe billing migration

## Current migration target

- Text conversation model: `@cf/zai-org/glm-4.7-flash` (text-only, lower-cost routing).
- Image understanding model: `@cf/qwen/qwen3.8-27b` (vision-capable).
- Initial Free plan: 40 credits per user per UTC day; one text message or one image message costs one credit.
- Pro (7 personalities) and Premium (10 personalities) are coming soon; no checkout is enabled in the initial release.
- TeddyBuddy White Label company-managed model routing is implemented; see [`ENTERPRISE_WHITE_LABEL.md`](./ENTERPRISE_WHITE_LABEL.md). The adapter supports a dedicated OpenAI-compatible company endpoint. A self-serve multi-tenant control plane and strict on-prem gateway are not implemented.
- Inference is routed through the gateway's Cloudflare Workers AI binding; the client must never receive provider credentials.
- PhonePe Payment Gateway is the intended checkout provider. Do not enable paid entitlements until merchant onboarding, signed webhook verification, idempotency, refunds and renewal events are implemented and tested.

## Required Cloudflare setup

1. Confirm the account's Workers AI free allowance and model pricing before launch. Any free daily allocation is shared by the Cloudflare account, not per Teddy Bud user; inference above the allowance may incur charges.
2. Configure the `AI` binding in `gateway-worker/wrangler.toml`.
3. Monitor actual Workers AI model usage and account-level spend; the daily free allocation is shared by the Cloudflare account, not per Teddy Bud user.
4. For every future release, stage a Worker version, verify bindings, deploy with rollback protection, and run health/auth smoke checks. Production Worker version `53e016c3-395f-44ad-9e1e-5c206710c27e` is deployed; authenticated text/vision requests still need a real-account smoke test.

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

## Initial launch validation

- [x] Replace OpenRouter-specific model discovery and request assumptions with server-side Cloudflare Workers AI routing.
- [x] Normalize streaming chunks into the chat protocol used by web, Android and desktop.
- [x] Cover normal replies, SSE streaming, image input, timeout/error handling and model routing in automated tests.
- [x] Enforce a 40-credit daily quota with one credit per text/image request, atomic reservation, and failure refunds. This is a usage cap, not a precise provider-cost ledger.
- [x] Run Worker tests and client typecheck; build the Android and desktop distributions; verify and commit the distribution set.
- [x] Deploy the Worker with binding preflight, production health checks and authentication-guard smoke tests.
- [ ] Run authenticated end-to-end text and vision smoke tests with a disposable test account before treating the full live chat path as verified.

## Future paid billing work

- [ ] Implement a detailed provider usage/cost ledger and budget reconciliation.
- [ ] Implement PhonePe checkout, signed webhooks, refunds and subscription/mandate lifecycle.
- [ ] Add migrations and tests for plans, payments, usage events and idempotency.
