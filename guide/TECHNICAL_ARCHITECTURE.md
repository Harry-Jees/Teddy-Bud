# Technical Architecture

## 1. Application architecture
Teddy Bud is a React Native application with an Electron desktop wrapper. The Vite/React Native Web renderer is used for local development and packaged desktop UI; there is no standalone hosted web app or web download. iOS/iPhone/iPad is not currently offered.

The client uses the configured Cloudflare Worker gateway for account operations and authenticated AI requests. Provider credentials remain server-side. Keep product copy and API details synchronized with the deployed Worker; historical provider migrations are not current routing specifications.

## 2. Account and identity
The user-facing account flow is username + password, with identity displayed as `@username`. Email/Gmail is not presented as an account identifier. Android biometric sign-in is optional after onboarding completion; password remains the fallback.

The client must not expose internal credential aliases or backend implementation details in the UI. Recovery may use the configured recovery passphrase, but it restores account access only; it does not restore another device's local data or encryption key.

## 3. Local storage and key handling
- Native app data uses encrypted local storage with platform secure credential storage for key material.
- Desktop local records use operating-system-backed encryption.
- The browser preview is development-only and must not be described as a supported hosted product.
- Portable backups are separately encrypted and require the user's backup passphrase.
- Chats, memories, journals, wellbeing entries, and preferences are local-first. No automatic cross-device sync is offered.

## 4. AI and privacy boundaries
All model inference is remote through the gateway. A response requires the provider to receive readable prompt content. Do not claim end-to-end encryption for AI conversations.

Only the current request and context permitted by the user's privacy controls should be sent. Journal and wellbeing text is not included automatically; sharing is explicit. Never ship provider secrets in the client or log user credentials, recovery phrases, or secret values.

The product's voice feature is speech-to-text input only. Recognition is user-initiated, its transcript is reviewed in the composer, and Teddy Bud does not generate spoken replies or provide voice playback.

## 5. Reliability and release constraints
The gateway is responsible for authentication validation, payload checks, approved model routing, rate limits, and usage enforcement. The Free allowance is 40 credits per UTC day; each text or image request costs one credit. This is a product usage cap, not an exact provider-cost ledger.

Automated tests and successful builds do not establish that production secrets, upstream model availability, real-device biometric behavior, accessibility, signing, or store distribution are verified. Use the release and feature-status documents for current verification evidence.
