# Security and Privacy

This document describes the intended privacy model and important limits. It must not be read as a guarantee that every deployment or device has been independently audited.

## Account identity
- The app-facing account identifier is a username; users sign in with username and password, not an email/Gmail address.
- The interface displays the identity as `@username`.
- Password recovery uses the user's recovery passphrase where configured. The phrase itself must never be displayed or logged by the app.
- Android biometric sign-in is an optional convenience configured after onboarding. The normal password path remains available.
- Account recovery does not recover another device's local chat history or database encryption key.

## Local data
Chats, memories, preferences, journals, and wellbeing entries are intended to remain local to the device. They are not silently synchronized across devices. Native database encryption uses SQLCipher with a key held in platform secure storage; desktop storage uses operating-system-backed encryption. Browser rendering is for development and internal desktop packaging only, not a standalone web product.

Local encryption protects persisted data at rest; it does not make data inaccessible to the app while unlocked, protect a compromised device, or guarantee that all operating-system backups are excluded. Consult platform behavior and test the shipped configuration.

## AI requests and context
The app sends a user message and the context needed for its response through the configured gateway over HTTPS. Provider credentials remain server-side. Privacy controls govern whether saved memories or selected context are included. Journal and wellbeing text is not included automatically; sharing must be user-initiated.

Do not claim end-to-end encryption for AI conversations: a remote inference provider must receive readable prompt content to generate a response. Transport encryption and local-at-rest encryption are different protections.

## Backups and recovery
Portable backups are separate encrypted files protected by the user's backup passphrase. Import must validate and preview content and require confirmation before merge or replacement. Password recovery is not a backup mechanism and cannot restore local records from a different device.

## Voice
Voice means speech-to-text input only. Recognition is user-initiated, and the transcript is reviewed in the composer before sending. Teddy Bud does not generate spoken replies or play voice output. A device or browser speech-recognition service may process audio according to its own terms; do not imply that platform processing is universally offline.

## Privacy language
Avoid absolute claims such as “100% private,” “zero data leaves your device,” “end-to-end encrypted,” or “AI never sees your data.” Explain which content is sent for a requested AI response and which personal records remain local.

## Verification limits
Automated tests and successful package builds do not prove real-device security, provider configuration, production deployment, or store readiness. Review the release verification guide and conduct device-specific testing.
