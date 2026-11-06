# Free-tier-first launch plan

## Launch decision

Teddy Bud launches with a single, clearly defined usage allowance. The client and gateway enforce the same published limits.

## Implemented Free-tier policy

- One unified allowance of **40 credits per user per UTC day**.
- Text requests cost **1 credit**.
- Image-containing requests cost **1 credit**, the same as a text request.
- The gateway detects image content and selects the model server-side: GLM-4.7 Flash for text, Qwen 3.8 27B for images.
- Four companion personalities are available in the current release.
- Durable Object storage reserves credits atomically before inference, refunds reservations on inference errors before a response is returned, and commits successful requests.
- Authenticated `GET /v1/credits` returns the current balance and reset time.
- The app's client cannot supply a user ID, plan, or credit cost to change its allowance.
- Automatic title and memory-suggestion tasks do not consume chat credits, but have a separate server-enforced cap of 10 background tasks per account per UTC day.
- Existing burst rate limiting, context size limits, and output-token caps remain in place.

Credits are a product-level usage guard, not an exact provider-cost ledger. Cloudflare Workers AI may charge the project account beyond any applicable allowance. Monitor actual model usage and account spend independently.

## Deployment status and safety

**Production deployment confirmed — 2026-11-06.** Cloudflare deployment metadata reports the production Worker on 100% traffic, with the Workers AI binding and required secret bindings present. The protected deployment workflow includes health checks, authentication-guard checks, CORS checks, and automatic rollback safeguards.

This confirms deployment and configuration, not a complete client acceptance test. Authenticated text and image requests from the current Android and desktop builds still require end-to-end smoke testing. Do not mark the full migration release-verified until both paths succeed.

Release verification:
1. Run gateway tests and client type checks/build.
2. Verify the production `AI` binding is present in the deployed Worker version.
3. Verify the required secret *names* are available to the deployed version without exposing secret values.
4. Verify daily credit reservation/refund, UTC reset, concurrency, text/image routing, and quota exhaustion.
5. Confirm the protected production deployment and automatic rollback safeguards; then perform authenticated text and image smoke tests. For enterprise deployments, separately validate the dedicated company endpoint using [ENTERPRISE_WHITE_LABEL.md](./ENTERPRISE_WHITE_LABEL.md).
6. Monitor Cloudflare AI usage and keep an emergency way to disable inference if spending exceeds budget.

## Launch messaging

Use wording such as “Free during the initial launch, with usage limits to keep the service available.” Do not promise unlimited use or permanent free access.

## Enterprise edition

The consumer application and **TeddyBuddy White Label** are separate products. See [the enterprise guide](./ENTERPRISE_WHITE_LABEL.md).
