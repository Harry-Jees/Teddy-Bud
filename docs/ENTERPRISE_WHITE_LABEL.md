# TeddyBuddy White Label — Enterprise deployment

## Offer

**TeddyBuddy White Label** is the enterprise deployment option for organisations that want to provide the Teddy Bud companion experience to their own customers, members, employees, or service users. It is a separate commercial deployment offer; it does not rename the standard Teddy Bud consumer app or silently change its identity.

The enterprise package is intended to support:
- A company-managed inference model rather than the default shared Workers AI models.
- A dedicated gateway deployment and company-controlled model endpoint.
- Company-specific distribution, onboarding, service configuration, privacy review, and deployment documentation.
- A path to organisation-specific visual assets and packaging, agreed per deployment.
- Usage metering and operational limits that remain separate from exact provider billing.

This is a technical deployment option, not a claim that a complete multi-tenant admin console, enterprise SLA, compliance certification, or managed sales programme already exists.

## Model routing

The gateway supports an OpenAI-compatible Chat Completions endpoint configured by the deployment operator. Configuration is server-side; end users cannot submit a URL or API key in a chat request.

Required Worker variables:
- `ENTERPRISE_MODE=true`
- `ENTERPRISE_MODEL_BASE_URL=https://model-gateway.company.example/v1` — the base URL only, without `/chat/completions`.
- `ENTERPRISE_TEXT_MODEL_ID=company/text-model`

Optional:
- `ENTERPRISE_VISION_MODEL_ID=company/vision-model` — configure only if the company model supports image input.
- `ENTERPRISE_MODEL_API_KEY` — set as a Worker secret, never as a plain variable or client-side value.

For example, configure the URL and model IDs with Wrangler variables, and store the API key with `npx wrangler secret put ENTERPRISE_MODEL_API_KEY`. Do not commit real URLs that expose internal infrastructure or any credentials to source control.

The endpoint must be HTTPS and reachable from the dedicated gateway deployment. For a model running only on a company LAN, expose it through a company-managed private connectivity layer or authenticated tunnel; a public Cloudflare Worker cannot directly reach an arbitrary private `localhost` address. Keep inference inside the company network whenever the organisation's deployment requirements demand strict on-premises processing. In that case, the gateway itself must run inside the network or be provided through a separately reviewed on-premises deployment.

The gateway selects the text model for text requests and the configured vision model for requests containing an image. If enterprise mode is enabled but its required endpoint/model configuration is incomplete, the gateway fails closed and does not fall back to Cloudflare Workers AI. If no vision model is configured, image requests are rejected with a clear message rather than sent to a different provider.

The endpoint must implement `POST /chat/completions` using OpenAI-compatible request and response formats, including SSE data events for streaming requests. Verify tool calling against the selected company model before enabling features that rely on structured tool calls.

## Isolation and security requirements

- Deploy a dedicated Worker and secret set per customer/organisation; do not share one mutable model URL or API key across unrelated tenants.
- Keep the model API key in the Worker secret store. Never place it in the app bundle, a settings field, a URL, logs, or source control.
- Configure the endpoint using operator-controlled deployment variables only. Never accept arbitrary inference URLs from end-user payloads.
- Use HTTPS, an authenticated tunnel or private network, network allowlists, request timeouts, and appropriate upstream rate limits.
- Confirm that request logs, model telemetry, retention, and data residency match the customer's contract and policies.
- Treat the existing 40-credit consumer allowance as a product limit, not an enterprise billing ledger. Enterprise usage, quotas, chargeback, tenant administration, audit export, and contractual SLAs need separate implementation and validation before being sold as managed features.
- Do not claim that local inference guarantees privacy by itself: deployment topology, logs, backups, and model-server configuration must also be reviewed.

## Validation checklist

1. Verify the configured model IDs appear from authenticated `GET /v1/models`.
2. Verify text requests reach only the configured company text endpoint.
3. Verify image requests reach only the configured company vision endpoint.
4. Verify incomplete enterprise configuration fails closed without calling Workers AI.
5. Verify upstream errors refund the reservation and do not leak credentials or upstream response bodies.
6. Verify streaming, structured tool calls, cancellation, timeouts, and image payload formats with the actual selected model server.
7. Complete a company security/privacy review and an end-to-end smoke test before distributing the enterprise build.

## Commercial positioning

Market this as **TeddyBuddy White Label — company-managed AI companion deployments**. Organisations can discuss their preferred model, network topology, branding requirements, distribution targets, user volume, privacy requirements, and support expectations. Quote and delivery dates should be confirmed only after a deployment assessment.
