# Security Policy

Teddy Bud handles account authentication, recovery, encrypted local conversation data, and requests to an external AI gateway. Please report suspected vulnerabilities responsibly.

## Supported versions

Security fixes are intended for the current default branch and the latest release artifacts that the project explicitly identifies as supported. Older builds may not receive fixes; update to the latest verified build when possible.

## Reporting a vulnerability

**Do not open a public GitHub issue for an unpatched security vulnerability.** Contact the repository owner privately through the contact method on the [maintainer's GitHub profile](https://github.com/Harry-Jees). If GitHub's private vulnerability reporting feature is enabled for this repository, that is also an appropriate channel.

Include, when safe:
- A concise description and impact.
- Affected component, platform, version, or commit.
- Reproduction steps using test accounts and synthetic data.
- Any proof-of-concept needed to establish the issue, avoiding access to real user data.
- Suggested mitigation, if known.

Do not include passwords, recovery passphrases, API keys, session tokens, production records, or another person's private conversations. Do not exploit the issue beyond what is necessary to demonstrate it.

## What to expect

The maintainer will acknowledge reports as soon as reasonably practical, investigate severity and reproducibility, and coordinate a fix and disclosure timeline with the reporter. This is a small project and no guaranteed response or remediation SLA is promised. Please allow time to investigate before public disclosure.

## Security-sensitive areas

Examples include:
- Authentication, password recovery, legacy-session migration, and session revocation/expiry.
- Authorization boundaries, Supabase row-level security, and service-role credentials.
- Local database encryption, key storage, backup/restore, and account/device isolation.
- Gateway request validation, origin controls, rate limits, and AI-provider credentials.
- Dependency and build supply-chain risks, signing, and distribution integrity.

## Deployment and user safety

Never commit secrets. Keep Supabase service-role credentials, recovery HMAC secrets, JWT signing secrets, and provider API keys in the server-side secret store only. Client-visible configuration must not contain privileged credentials. Build artifacts described as unsigned or simulator-only must not be represented as production-store releases.

This policy does not guarantee that the application is free of vulnerabilities or that every platform build has been independently audited.
