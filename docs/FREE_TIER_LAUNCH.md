# Free-tier-first launch plan

## Launch decision

Teddy Bud launches with one plan: **Free**. Do not add checkout, payment-provider SDKs, subscription screens, upgrade prompts, paid entitlements, or payment secrets to the launch build. Pro and other paid tiers are deferred until real usage and inference costs are measured.

## Implemented Free-tier policy

- One unified allowance of **40 credits per user per UTC day**.
- Text requests cost **1 credit**.
- Image-containing requests cost **5 credits**.
- The gateway detects image content and selects the model server-side: GLM-4.7 Flash for text, Qwen 3.8 27B for images.
- Durable Object storage reserves credits atomically before inference, refunds reservations on inference errors before a response is returned, and commits successful requests.
- Authenticated `GET /v1/credits` returns the current balance and reset time.
- The app's client cannot supply a user ID, plan, or credit cost to change its allowance.
- Existing burst rate limiting, context size limits, and output-token caps remain in place.

Credits are a product-level usage guard, not an exact billing ledger. Cloudflare Workers AI may charge the project account beyond any applicable allowance. Monitor actual model usage and account spend independently.

## Deployment status and safety

The migration code is committed to `migration/cloudflare-workers-ai-phonepe`; it is **not yet live**. A staged version (`6ceee0eb-cc75-4cfc-b6cf-a6cb42ea7765`) was uploaded and verified to contain the `AI` binding plus the existing Supabase/auth secret binding names. The active production deployment is still the previous OpenRouter version. Keep it active until CI and the staged code are validated; the staged version has not been deployed.

Before deployment:
1. Run gateway tests and client type checks/build.
2. Verify `AI` binding is present in the staged Worker version.
3. Verify the required secret *names* are available to the new version without exposing secret values.
4. Verify daily credit reservation/refund, UTC reset, concurrency, text/image routing, and quota exhaustion.
5. Deploy via the protected workflow with automatic rollback; then perform authenticated text and image smoke tests.
6. Monitor Cloudflare AI usage and keep an emergency way to disable inference if spending exceeds budget.

## Future paid tiers

Keep future plan/entitlement logic provider-independent, but do not collect payments yet. When the product is ready, compare and test providers such as Razorpay and Cashfree, confirm merchant eligibility and all-in recurring fees, then add checkout and signed webhook handling in a separate release. A paid plan must not be advertised or activated until payment verification, idempotency, refunds, cancellations, renewals, and durable entitlement updates are tested.

## Launch messaging

Use wording such as “Free during the initial launch, with usage limits to keep the service available.” Do not promise unlimited use or permanent free access. Pro and other paid plans may be introduced later, after costs and demand are understood.
