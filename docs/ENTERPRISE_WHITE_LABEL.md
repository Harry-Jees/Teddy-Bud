# TeddyBuddy White Label — Enterprise deployment

## Offer

**TeddyBuddy White Label** is the enterprise deployment option for organisations that want to provide the Teddy Bud companion experience to their own customers, members, employees, or service users. It is a separate commercial deployment offer; it does not rename the standard Teddy Bud consumer app.

The enterprise package is intended to support company-managed inference, a dedicated gateway deployment, organisation-specific distribution and visual assets, and deployment requirements agreed per customer. This is a technical integration foundation, not a claim that a multi-tenant admin console, enterprise SLA, compliance certification, or managed sales programme already exists.

## Model routing

The gateway supports an OpenAI-compatible Chat Completions endpoint configured by the deployment operator. End users cannot submit a URL or API key in a chat request.

Required Worker variables:
- `ENTERPRISE_MODE=true`
- `ENTERPRISE_MODEL_BASE_URL=https://model-gateway.company.example/v1` — base URL without `/chat/completions`.
- `ENTERPRISE_TEXT_MODEL_ID=company/text-model`

Optional:
- `ENTERPRISE_VISION_MODEL_ID=company/vision-model` — configure only if the company model supports image input.
- `ENTERPRISE_MODEL_API_KEY` — store as a Worker secret, never as a plain variable or client-side value.

Configure non-secret values with Wrangler variables and the API key with `npx wrangler secret put ENTERPRISE_MODEL_API_KEY`. Do not commit credentials or internal infrastructure details to source control.

The endpoint must use HTTPS and be reachable from the dedicated gateway. For a model running only on a company LAN, use company-managed private connectivity or an authenticated tunnel. A public Cloudflare Worker cannot directly reach an arbitrary private `localhost` address. If an organisation requires that inference and all request handling remain entirely inside its network, the gateway itself must also run inside that network; treat that as a separately assessed on-premises deployment, not as a capability delivered by this Worker alone.

Text requests route to the configured text model. Requests containing an image route to the configured vision model. If enterprise mode is enabled but its required endpoint/model configuration is incomplete, the gateway fails closed and does not fall back to Workers AI. If no vision model is configured, image requests are rejected rather than sent to another provider.

The endpoint must implement `POST /chat/completions` with OpenAI-compatible request/response JSON and SSE data events for streaming. Verify structured tool calls against the selected model before enabling dependent features.

## Isolation and security requirements

- Deploy a dedicated Worker and secret set per organisation; do not share a mutable model URL or API key across unrelated customers.
- Keep inference API keys in the Worker secret store, never in app code, settings, URLs, logs, or source control.
- Accept model endpoints only from operator-controlled deployment configuration, never from end-user payloads.
- Use HTTPS, authenticated private connectivity, network allowlists, timeouts, and upstream rate limits.
- Review request logging, telemetry, retention, backups, and data residency against the customer's requirements.
- The existing 40-credit consumer allowance is a product usage limit, not an enterprise billing ledger. Tenant administration, audit export, chargeback, contractual SLAs, and enterprise metering require separate implementation and validation before being sold as managed features.
- Local inference alone does not guarantee privacy; deployment topology, logs, backups, and model-server configuration must also be reviewed.

## Validation checklist

1. Confirm authenticated `GET /v1/models` lists the configured company model IDs.
2. Confirm text requests reach only the configured text endpoint.
3. Confirm image requests reach only the configured vision endpoint.
4. Confirm incomplete enterprise configuration fails closed without calling Workers AI.
5. Confirm upstream failures refund credit reservations and do not expose credentials or upstream response bodies.
6. Test streaming, tool calls, cancellation, timeouts, and image formats against the actual model server.
7. Complete a customer security/privacy review and authenticated end-to-end smoke test before distribution.

## Commercial positioning

Market this as **TeddyBuddy White Label — company-managed AI companion deployments**. Scope the preferred model, network topology, branding, packaging, target platforms, user volume, privacy requirements, and support expectations with each organisation. Confirm price and delivery dates only after a deployment assessment.
