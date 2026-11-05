# Gateway Worker README

Teddy Bud Gateway Worker handles authenticated AI requests. Client provider credentials remain server-side.

The client-facing account identity is username and password, displayed as `@username`; email/Gmail is not the account identifier. Password recovery may use the recovery passphrase. Recovery restores account access, not local chat history or device encryption keys.

The current Free allowance is 40 credits per UTC day; text and image requests each cost one credit. This is a usage limit, not a provider-cost guarantee. Voice in Teddy Bud is speech-to-text input only; no spoken replies or TTS.

Keep deployment documentation synchronized with actual routes, migrations, secrets, and model routing. Automated tests and successful builds do not establish production readiness; verify authenticated text/image requests and the staged Worker before production promotion.
