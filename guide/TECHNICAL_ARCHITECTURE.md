# Technical Architecture & API Contract

## 1. System Architecture
The client app is built in React Native. It operates as a thin, secure client connecting to a remote Gateway (Cloudflare Worker) which proxies to NVIDIA-hosted AI APIs.

## 2. Tech Stack
- **Frontend**: React Native (with `react-native-windows` for desktop support)
- **Local Storage**: Encrypted SQLite Database
- **Key Management**: Native Secure Storage (Android Keystore / Windows Credential Locker)

## 3. Gateway Boundary (API Contract)
The client relies entirely on an external Cloudflare Worker gateway via HTTPS. Fake transports/mocks should only be used in unit tests, not for live capabilities.

### External Endpoints
- `POST /auth/register`: Device registration.
- `POST /auth/verify`: Device verification.
- `GET /health`: Gateway health check.
- `GET /v1/models`: AI model discovery.
- `POST /v1/chat/completions`: Main chat endpoint (Supports non-streaming and SSE streaming).

## 4. AI Constraints
- **Cloud-only AI**: All AI inference happens remotely. No local inference tools are permitted.
- The client must not infer gateway routes, response schemas, model IDs, token semantics, or deployment behavior that have not been explicitly supplied by the gateway contract.
