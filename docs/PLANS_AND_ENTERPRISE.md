# Teddy Bud plans and deployment modes

## Launch plan: Free

- Price: free during the initial launch.
- Daily allowance: 40 credits per account, reset at 00:00 UTC.
- Text message: 1 credit.
- Image message: 1 credit.
- Four available personalities: Teddy, Doodle, Sunny, and Mellow.
- Text model: Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`.
- Image understanding model: Cloudflare Workers AI `@cf/qwen/qwen3.8-27b`.
- Paid plans are announced as coming soon; checkout and paid entitlements stay disabled until billing is implemented and verified.

The gateway—not the client—determines whether a request contains an image, chooses the model, and reserves the credit. Credits are a product allowance and are not a statement of actual inference cost. Monitor model usage and Cloudflare account charges separately.

## Planned consumer plans

| Plan | Personalities | Model direction | Availability |
|---|---:|---|---|
| Free | 4 | GLM text, Qwen vision | Initial release |
| Pro | 7 | Better text and vision models, higher allowance | Coming soon |
| Premium | 10 | Highest quality approved models and larger allowance | Coming soon |

The Pro and Premium character sets include all Free personalities plus three additional personalities per tier. The app may show locked personalities and clearly label them as coming soon, but must not imply a subscription can be purchased yet.

Do not publish paid credit amounts or prices until real inference costs, model limits, account-level Cloudflare usage, abuse controls, and payment fees have been measured.

## Enterprise / local inference mode

Enterprise deployments should support an administrator-managed model endpoint so an organization can run an approved model on its own infrastructure and route Teddy Bud inference to that service.

Target architecture:

1. The client authenticates to the organization's Teddy Bud gateway.
2. The gateway applies organization policy, per-user quotas, model allowlists, and audit-safe operational metrics.
3. A server-side provider adapter routes each request to either Cloudflare Workers AI or the configured enterprise inference service.
4. For local inference, support an OpenAI-compatible chat-completions endpoint where practical (for example, an organization-managed vLLM or Ollama-compatible gateway). Verify image/multimodal support separately; not every local model supports vision.
5. The endpoint URL, credentials, allowed models, and TLS policy are configured by an authorized administrator—not by ordinary end users.

Security requirements:

- Never let a normal client supply an arbitrary inference URL; this would create an SSRF and credential-exfiltration risk.
- Prefer a private network, VPN, Cloudflare Tunnel, or an organization-controlled gateway over exposing a model server directly to the public internet.
- Require HTTPS for remote endpoints, authentication, request timeouts, payload limits, and strict model allowlists.
- Keep enterprise credentials in server-side secrets and never send them to the client.
- Make provider routing independent of plans, credit accounting, and character selection.
- Allow organizations to disable external inference entirely when their privacy policy requires local-only processing.
- Clearly show whether a conversation is being processed by Cloudflare or the organization's local server.

This document defines the target architecture; enterprise endpoint configuration and deployment management are not yet implemented.
