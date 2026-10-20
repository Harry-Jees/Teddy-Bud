# Support

## Where to ask

- **Bug or unexpected behavior:** open a GitHub issue using the bug report template.
- **Feature idea:** open a feature request with the user problem and expected outcome.
- **How-to question:** check the [main README](README.md), [client README](client/README.md), [guide index](guide/README.md), and [gateway Worker README](gateway-worker/README.md) first.
- **Security concern:** follow [SECURITY.md](SECURITY.md); do not publish exploit details for an unpatched issue.

Please avoid posting account identifiers, private conversations, passwords, recovery phrases, API keys, session tokens, or production logs.

## Useful troubleshooting steps

1. Record the app version/commit, operating system, target platform, and exact steps that led to the issue.
2. Determine whether the issue affects the web client, native app, Electron desktop wrapper, or gateway.
3. Reproduce with a fresh test account and synthetic data when possible.
4. For local development, use Node.js 22.12 or newer and install dependencies with `npm ci` in the relevant package.
5. Run client tests with `npm test -- --runInBand` and type checks with `npx tsc --noEmit` from `client/`; run Worker tests with `npm test` from `gateway-worker/`.
6. For a packaged build, compare the exact artifact and commit with the latest successful [Actions workflow](https://github.com/Harry-Jees/Teddy-Bud/actions).
7. Include the relevant error message with secrets and personal information removed.

## Platform limitations

- The iOS ZIP currently documented in `dist/` is an iOS Simulator build, not an installable iPhone release.
- Desktop installers may be unsigned development packages. Public Windows/macOS distribution requires the appropriate signing and platform release steps.
- A successful CI build does not establish real-device compatibility for every OS version.
- Chat data is locally encrypted and device/account scoped; password recovery does not restore local keys or transfer local chat history to a new device.

Support is provided on a best-effort basis; no response-time guarantee is implied.
