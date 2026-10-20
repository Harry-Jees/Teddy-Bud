# Security Policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in public issues or pull requests. Use GitHub's private vulnerability reporting feature for this repository when available. If it is unavailable, contact the repository owner privately through GitHub to coordinate a responsible disclosure.

Include the affected component, impact, reproduction steps, and any relevant logs with secrets and personal data removed.

## Security expectations

- Never commit credentials, API keys, tokens, signing material, or production user data.
- Keep dependencies and GitHub Actions up to date.
- Validate untrusted input at trust boundaries and avoid returning secrets or internal provider details in errors.
- Avoid logging message content, authentication material, or other sensitive user data.
- Report security fixes privately until a coordinated fix is available.
