# Contributing to Teddy Bud

Thanks for helping improve Teddy Bud. Please keep changes focused, reviewable, secure, and compatible with existing supported platforms.

## Before opening a pull request

- Explain the problem and the intended outcome.
- Keep user-visible behavior and UI unchanged unless the change explicitly requires it.
- Never commit API keys, credentials, personal data, signing keys, or generated secrets.
- Add or update tests for behavior changes and bug fixes.
- Update documentation when setup, configuration, or behavior changes.
- Keep dependencies minimal and use the lockfiles; explain new runtime dependencies.
- Prefer small, typed functions and explicit error handling over broad exception suppression.

## Local checks

From `client/`:

```sh
npm ci
npm run lint
npm test -- --runInBand
npx tsc --noEmit
```

From `gateway-worker/`:

```sh
npm ci
npm test
```

For Python distribution utilities, install Ruff and run:

```sh
ruff check scripts
```

CI is the source of truth for the required checks. Do not mark a check as passing unless it has actually completed successfully.

## Pull request expectations

- Describe what changed and why.
- List tests and checks run, including failures or checks not run.
- Include screenshots only when the UI intentionally changes.
- Keep one logical concern per pull request and avoid unrelated formatting churn.
