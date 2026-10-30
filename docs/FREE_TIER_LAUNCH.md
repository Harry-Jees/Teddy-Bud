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

The Cloudflare Workers AI migration and enterprise model-routing adapter are under validation. Do not assume the branch is production-ready from a staged deployment or direct provider smoke test alone. Check the latest CI results and run authenticated end-to-end tests before directing production traffic.

Before deployment:
1. Run gateway tests and client type checks/build.
2. Verify `AI` binding is present in the staged Worker version.
3. Verify the required secret *names* are available to the new version without exposing secret values.
4. Verify daily credit reservation/refund, UTC reset, concurrency, text/image routing, and quota exhaustion.
5. Deploy via the protected workflow with automatic rollback; then perform authenticated text and image smoke tests. For enterprise deployments, separately validate the dedicated company endpoint using [ENTERPRISE_WHITE_LABEL.md](./ENTERPRISE_WHITE_LABEL.md).
6. Monitor Cloudflare AI usage and keep an emergency way to disable inference if spending exceeds budget.

## Launch messaging

Use wording such as “Free during the initial launch, with usage limits to keep the service available.” Do not promise unlimited use or permanent free access.

## Enterprise edition

The consumer application and **TeddyBuddy White Label** are separate products. See [the enterprise guide](./ENTERPRISE_WHITE_LABEL.md).
