# Production readiness boundary

Teddy Bud is a client application. The Cloudflare Worker gateway is an external
dependency and is intentionally not implemented in this repository.

The client must not infer gateway routes, response schemas, model IDs, token
semantics, or deployment behavior that have not been supplied by the gateway
owner. Fake transports are permitted only in unit and contract tests and must
never be treated as live connectivity.

## Blocked E2E checks

Live gateway health, device registration, authenticated model discovery, live
`hello` chat, and streaming verification remain blocked until the gateway owner
provides a reachable endpoint and authoritative contract. The required inputs
are the real URL, authentication flow, request/response schemas, model catalog
behavior, and permission to register a test device and send `hello`.

## Release gates

- `python -m pytest tests -q` passes in a clean writable environment.
- `python -m compileall -q main.py teddy_bud tests` passes.
- Windows and Android artifacts build with secure-storage support validated.
- Client-only security, storage, UI, and failure-path tests pass.
- Live-chat E2E is explicitly marked blocked until the external dependency is available.
