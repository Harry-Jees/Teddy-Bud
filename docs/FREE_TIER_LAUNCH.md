# Free-tier-first launch plan

## Launch decision

Teddy Bud launches with one plan: **Free**. Do not add checkout, payment-provider SDKs, subscription screens, upgrade prompts, paid entitlements, or payment secrets to the launch build. Pro and other paid tiers are deferred until real usage and inference costs are measured.

This does not mean AI inference is cost-free to operate. Cloudflare Workers AI may charge the project account beyond any applicable free allowance. The product's free plan must therefore have server-enforced limits.

## Free tier safeguards

- Keep authentication and the existing gateway-side burst rate limit.
- Enforce per-user usage limits in the gateway, never only in the client.
- Prefer accounting by actual provider usage/cost when available; message counts are only a temporary abuse guard, not a cost ledger.
- Bound input context and output tokens; reject oversized requests before inference.
- Keep image/vision requests on the more expensive vision model only when an image is present.
- Add a clear, friendly limit-reached response and a reset time where the configured quota supports one.
- Never let a client-provided user ID, plan name, model ID, usage amount, or price grant extra quota.
- Keep limits configurable and conservative until production-like usage and Cloudflare billing data have been reviewed.

## Before enabling a public free quota

1. Confirm the exact Cloudflare Workers AI models enabled in the deployed account and verify their billing/availability.
2. Implement durable per-user daily accounting and atomic reservation/reconciliation before exposing a quota as guaranteed.
3. Add tests for quota exhaustion, UTC/day rollover, concurrent requests, provider failures, image requests, and attempts to spoof identity or plan.
4. Set the initial quota based on the account's actual budget and expected active users; do not assume Cloudflare's account-level free allowance is a per-user allowance.
5. Monitor spend and have a way to disable or reduce inference traffic if account spend exceeds the operating budget.

## Future paid tiers

Keep the future plan/entitlement interface provider-independent, but do not collect payments yet. When the product is ready, compare and test providers such as Razorpay and Cashfree, confirm merchant eligibility and all-in recurring fees, then add checkout and signed webhook handling in a separate release. A paid plan must not be advertised or activated until payment verification, idempotency, refunds, cancellations, renewals, and durable entitlement updates are tested.

## Launch messaging

Use wording such as “Free during the initial launch, with usage limits to keep the service available.” Do not promise unlimited use or permanent free access. Pro and other paid plans may be introduced later, after costs and demand are understood.
