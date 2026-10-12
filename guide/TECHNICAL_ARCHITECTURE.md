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
- `POST /auth/exchange`: Exchanges the Cloudflare Access callback code for an app JWT.
- `GET /health`: Gateway health check.
- `GET /v1/models`: AI model discovery.
- `POST /v1/chat/completions`: Main chat endpoint (Supports non-streaming and SSE streaming).

## 4. AI Constraints
- **Cloud-only AI**: All AI inference happens remotely. No local inference tools are permitted.
- The client must not infer gateway routes, response schemas, model IDs, token semantics, or deployment behavior that have not been explicitly supplied by the gateway contract.

## 5. Cloudflare Access login
The app opens the configured Cloudflare Access login URL in the system browser. The web build returns to `/auth/callback`; Android and iOS return through the `teddybud://auth/callback` deep link. The callback may provide an `access_token`/`token` directly or a short-lived `code`, which is exchanged at `/auth/exchange`. The resulting JWT is checked for expiry and attached as `Authorization: Bearer <jwt>` to model discovery and chat requests.

Configure the Access login URL with `VITE_CLOUDFLARE_ACCESS_LOGIN_URL` in the web build. The default is `${GATEWAY_BASE_URL}/auth/login`; the gateway must implement the redirect and exchange contract before release. Register these callback URLs in Cloudflare Access:

- Web: `https://<web-host>/auth/callback`
- Android/iOS: `teddybud://auth/callback`
