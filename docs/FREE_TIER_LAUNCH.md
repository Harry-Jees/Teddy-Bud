# Free-tier-first launch plan

## Launch decision

Teddy Bud launches with one plan: **Free**. Do not add checkout, payment-provider SDKs, subscription screens, upgrade prompts, paid entitlements, or payment secrets to the launch build. Pro and other paid tiers are deferred until real usage and inference costs are measured.

## Implemented Free-tier policy

- One unified allowance of **40 credits per user per UTC day**.
- Text requests cost **1 credit**.
- Image-containing requests cost **1 credit**, the same as a text request.
- The gateway detects image content and selects the model server-side: GLM-4.7 Flash for text, Qwen 3.8 27B for images.
- Free includes four personalities; Pro will offer seven and Premium ten when those plans launch.
- Durable Object storage reserves credits atomically before inference, refunds reservations on inference errors before a response is returned, and commits successful requests.
- Authenticated `GET /v1/credits` returns the current balance and reset time.
- The app's client cannot supply a user ID, plan, or credit cost to change its allowance.
- Automatic title and memory-suggestion tasks do not consume chat credits, but have a separate server-enforced cap of 10 background tasks per account per UTC day.
- Existing burst rate limiting, context size limits, and output-token caps remain in place.

Credits are a product-level usage guard, not an exact billing ledger. Cloudflare Workers AI may charge the project account beyond any applicable allowance. Monitor actual model usage and account spend independently.

## Deployment status and safety

The Cloudflare Workers AI migration and enterprise model-routing adapter are under validation on `migration/cloudflare-workers-ai-phonepe`. Do not assume the branch is production-ready from a staged deployment or direct provider smoke test alone. Check the latest CI results and run authenticated end-to-end tests before directing production traffic.

Before deployment:
1. Run gateway tests and client type checks/build.
2. Verify `AI` binding is present in the staged Worker version.
3. Verify the required secret *names* are available to the new version without exposing secret values.
4. Verify daily credit reservation/refund, UTC reset, concurrency, text/image routing, and quota exhaustion.
5. Deploy via the protected workflow with automatic rollback; then perform authenticated text and image smoke tests. For enterprise deployments, separately validate the dedicated company endpoint using [ENTERPRISE_WHITE_LABEL.md](./ENTERPRISE_WHITE_LABEL.md).
6. Monitor Cloudflare AI usage and keep an emergency way to disable inference if spending exceeds budget.

## Future paid tiers

Pro and Premium are announced as coming soon only; checkout and paid entitlements remain disabled. Pro is planned for seven personalities and improved models; Premium is planned for ten personalities and the highest model tier. Do not expose locked personalities as selectable in Free.

Keep future plan/entitlement logic provider-independent, but do not collect payments yet. When the product is ready, compare and test providers such as Razorpay and Cashfree, confirm merchant eligibility and all-in recurring fees, then add checkout and signed webhook handling in a separate release. A paid plan must not be advertised or activated until payment verification, idempotency, refunds, cancellations, renewals, and durable entitlement updates are tested.

## Launch messaging

Use wording such as “Free during the initial launch, with usage limits to keep the service available.” Do not promise unlimited use or permanent free access. Pro and other paid plans may be introduced later, after costs and demand are understood.

## Enterprise edition

The consumer Free plan remains separate from **TeddyBuddy White Label**, the enterprise deployment offer. See [the enterprise guide](./ENTERPRISE_WHITE_LABEL.md). Do not add checkout or paid consumer entitlements to the first Free release.
