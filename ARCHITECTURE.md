# Teddy Bud architecture

Teddy Bud is a local-first Kivy client. The external Cloudflare Worker is a
gateway dependency, not part of this repository.

## Layers

```text
Kivy screens/widgets
        |
Application state and workflows (AppState, screen actions)
        |
Domain services (ConversationService, MemoryService, SafetyLayer)
        |
Repositories and privacy/context policies
        |
SQLCipher + OS secure storage       HTTPS gateway adapter
```

UI code does not execute SQL, perform cryptography, or construct raw gateway
requests. The conversation workflow validates input, stores the local user
turn, builds minimized/redacted context, calls the external gateway adapter,
validates the response, and stores the assistant turn. Failed AI requests roll
back the local user turn so a retry cannot duplicate it.

## External boundary

`GatewayTransport`, `DeviceAuthenticator`, `AIClient`, and
`CloudflareGatewayProvider` contain the client-side gateway integration. They
only implement behavior already represented by the client contract. The Worker
source, deployment, model catalog, token semantics, and authoritative schemas
are not present here and must not be inferred.

## State and failure behavior

`AppState.status` distinguishes startup, ready, sending, storage unavailable,
gateway unavailable, and gateway error states. Transport errors are mapped to
safe application messages. UI callbacks carry a request generation so a stale
background response cannot update a superseded screen state.

## Data ownership

Conversation history, approved memories, and settings remain in the local
SQLCipher database. Database and device credentials are held by the configured
OS secure store. Clear-all removes the database, database key, device identity,
and cached gateway token.
