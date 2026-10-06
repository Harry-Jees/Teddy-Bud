# Gateway boundary

The Cloudflare Worker is external and is not implemented in this repository.
This document records the client boundary only; it is not an authoritative
Worker specification.

## Client adapter operations

The current client adapter has methods for device registration, device
verification, model discovery, non-streaming chat, and optional SSE streaming.
The transport requires HTTPS and maps HTTP/network failures into typed client
errors.

The client currently references the following externally owned paths:

- `/auth/register`
- `/auth/verify`
- `/health`
- `/v1/models`
- `/v1/chat/completions`

Their request fields, response fields, authentication semantics, model catalog,
rate limits, and deployment status must be confirmed by the gateway owner. No
implementation in this repository treats fake transport tests as live gateway
success.

## Blocked verification

Live health, registration, authentication, model discovery, `hello` chat, and
streaming tests are blocked while the configured endpoint is unreachable and
the Worker source/authoritative contract is unavailable. Do not mark the app
live-chat ready until a real endpoint is reachable and the contract is
confirmed.
