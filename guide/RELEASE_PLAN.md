# Release & Testing Plan

## 1. Testing Strategy
- **Unit Tests**: Full coverage for UI rendering, failure paths, and state management.
- **Secure Storage Validation**: Automated tests verifying that credentials cannot be accessed without proper OS-level authentication.
- **E2E/Gateway Tests**: Blocked until the external Cloudflare Worker gateway provides a reachable endpoint and an authoritative contract. The real URL, authentication flow, and schemas must be supplied by the gateway owner.

## 2. Release Gates
- Automated tests pass in a clean CI environment.
- Android builds (`.apk`) and Windows builds (`.exe`) compile without errors.
- Secure storage integration is visually and technically verified on physical target devices (or rigorous emulators).
- Client-only security and failure-path checks (network loss, API timeout) pass gracefully.
