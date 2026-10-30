# Teddy Bud feature status

Last reviewed: 2026-10-25  
Working branch: `feature/phase-3-chat-polish`

This document distinguishes implemented code from features that still need credentials, architecture work, or release verification. A checked-in implementation is not automatically a production-ready or store-certified feature.

## Available in the current client

- Chat with streamed AI replies through the authenticated gateway.
- Retry after an eligible failed request, stop an in-flight reply, and display loading/error states.
- Rename and pin conversations; browse conversation history.
- Choose among the four Free companion personalities and customize their names.
- Optional, explicitly controlled sharing of saved memories, cross-chat context, and About Me notes.
- Local journal entries with prompts, editing, deletion, search, and text export.
- Explicit **Discuss with Teddy** action that places a journal entry into the chat composer for review; it is not sent automatically.
- Local emotion check-ins, editable/deletable entries, radar visualization, recent trends, and offline wellbeing exercises.
- Local seven-day reflection calculated from at least two user-entered check-ins; descriptive only, not diagnostic.
- Encrypted `.teddybud` backup and restore with passphrase and account-owner checks; import now previews record counts and asks before replacing data.
- Backup import previews record counts and offers **Merge records** or **Replace data**. Merge preserves current preferences, deduplicates repeated records, resolves conflicting memory IDs, and keeps the newer snapshot for a matching conversation.
- Share assistant replies on native platforms and copy them to the clipboard on web when the browser Clipboard API is available.
- Edit and resend the latest user message, replacing the old message and subsequent reply; regenerate the latest assistant reply.
- Local-first storage; journal and check-in data are not added to AI context unless the user explicitly shares relevant text.

## Gateway and distribution foundations

- Authenticated gateway with rate limiting, model allowlists, server-side model routing, SSE streaming, image validation, and daily credit reservation/refund.
- Free allowance: 40 chat credits per UTC day; one credit per text or image request. Background tasks use a separate daily cap.
- Enterprise mode supports an administrator-configured OpenAI-compatible model endpoint, with a separate vision model required for image requests. This is a deployment foundation, not a self-serve tenant control plane.
- CI builds Android ARM64 APK, Windows x64 and ARM64 installers, macOS Apple Silicon and Intel DMGs, and Linux DEB/AppImage packages. Distribution publishing is only complete when the current workflow run and exact file-set verifier succeed.

## Not production-ready / still unimplemented

| Area | Remaining work | Why it is not marked complete |
|---|---|---|
| Enterprise administration | Tenant provisioning, admin console, per-user quotas, operational audit exports, chargeback, policy management | Current endpoint configuration is deployment-managed; no self-serve multi-tenant control plane. |
| Voice | Speech capture, transcription, playback, permission handling, privacy controls, platform testing | Requires a deliberate cross-platform audio architecture and additional native dependencies. |
| Reminders/notifications | User-controlled schedules, permission handling, local notification implementation and tests across platforms | Not implemented by the current client. |
| Single-device enforcement | Verify on the deployed Worker and exercise concurrent logins under production-like load | The Durable Object atomically selects one active session per account, migrates the legacy session-ID index on access, and every authenticated request checks the active ID. Tests cover a new login invalidating an old token, legacy index migration, and stale-session removal. Production deployment and concurrency verification remain. |
| End-to-end encrypted AI conversations | A design compatible with the inference model and privacy requirements | A remote model must receive readable prompt content; current transport encryption is not end-to-end encryption. |
| Backup restore safety | Add interrupted-write/rollback tests and verify the native/web confirmation flows on real devices | Preview, explicit merge/replace choice, merge logic, and duplicate handling are implemented; real-device and failure-injection validation remain. |
| Live production smoke tests | Authenticated text and vision requests using a disposable test account | Automated tests do not prove that current production secrets, bindings, merchant settings, or external accounts are configured correctly. |

## Release gates

1. Run client tests, TypeScript checks, web build, and gateway tests on the latest feature commit.
2. Build every supported platform from that same commit.
3. Verify exact distribution names, package structure, architecture targets, and the complete `dist/` file set.
4. Complete install-and-launch tests on real target devices; inspect signing and notarization requirements.
5. Run authenticated production text/vision smoke tests without exposing real user data or secrets.
6. Keep unsupported platform and enterprise sales claims disabled until their dedicated gates pass.
