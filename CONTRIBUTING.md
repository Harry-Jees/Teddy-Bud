# Contributing to Teddy Bud

Thank you for considering a contribution. Teddy Bud handles private conversations and account credentials, so correctness, privacy, accessibility, and clear communication matter more than the size of a change.

## Before you start

- Read the [README](README.md), [client guide](client/README.md), [guide index](guide/README.md), [security and privacy model](guide/SECURITY_AND_PRIVACY.md), and [gateway setup](gateway-worker/README.md) relevant to your change.
- Search existing issues and pull requests before opening a new one.
- For substantial changes, open an issue first to agree on scope. Do not spend time on a large implementation before the design is agreed.
- Never include real user conversations, personal data, credentials, API keys, session tokens, recovery phrases, or production database contents in issues, tests, screenshots, logs, or commits.

## Development setup

Requirements: Node.js 22.12 or newer.

```sh
cd client
npm ci
npm run web
npm test -- --runInBand
npx tsc --noEmit
```

For gateway Worker tests:

```sh
cd gateway-worker
npm ci
npm test
```

Run `python scripts/verify_distributions.py` from the repository root when you intentionally change committed distribution artifacts. Do not rebuild or commit generated distributions for documentation-only changes.

## Contribution expectations

1. Keep changes focused and explain the user or maintenance problem they solve.
2. Preserve the current product UI and behavior unless the change explicitly requests a product change.
3. Follow existing TypeScript, React Native, Worker, and test conventions. Prefer small, typed functions and clear names over clever abstractions.
4. Add or update tests for behavior changes, especially authentication, session expiry, local encryption, backups, account scoping, gateway validation, and recovery.
5. Update the relevant documentation when commands, configuration, behavior, architecture, security assumptions, or release artifacts change.
6. Do not add dependencies unless they provide clear value. Explain new runtime or build dependencies in the pull request.
7. Do not commit generated secrets, local environment files, build caches, or unrelated formatting churn.
8. Avoid claiming a platform is supported merely because its package compiles. State whether it is simulator-only, unsigned, or otherwise limited.

## Security-sensitive changes

Authentication, recovery, encryption, key management, session handling, gateway authorization, database policies, and secret handling need extra scrutiny. Describe the threat model and migration/rollback implications. Never weaken authorization or expose service-role keys to make a test pass. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), rather than opening a public issue.

## Pull request checklist

- [ ] The problem and intended behavior are explained.
- [ ] Changes are limited to the stated scope.
- [ ] Relevant tests and type checks were run, or the reason they were not run is stated.
- [ ] Security, privacy, accessibility, and error states were considered.
- [ ] Documentation and examples match the implementation.
- [ ] No credentials, personal data, or unrelated generated artifacts are included.
- [ ] Platform/build claims match what was actually verified.
- [ ] Screenshots or recordings, if useful, contain no private user data.

## Review and release

Maintainers may request changes, tests, documentation, or a narrower scope. Passing automated checks is necessary but does not prove that an app is secure or that every platform works on real hardware. Release artifacts and supported build limitations are documented in [distribution verification](guide/DISTRIBUTION_VERIFICATION.md).

By contributing, you agree that your contribution may be reviewed and redistributed under the project's applicable license. No license is currently declared in this repository; please do not assume that public visibility grants permission to reuse the code. A repository license must be chosen by the project owner.
