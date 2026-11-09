# Teddy Bud Client

The client contains Teddy Bud's React Native application and Electron desktop wrapper. The browser-rendered UI is an internal development/desktop packaging detail; Teddy Bud is not distributed as a standalone web app.

## Product requirements
Teddy Bud is a warm, mature, local-first AI companion—“A little room to breathe.” The UI uses light-only warm ivory, clay, and cocoa colors, claymorphism with Material 3 foundations, an 8-point spacing rhythm, clear hierarchy, accessible hit targets, and restrained motion. No dark mode.

Account access is username + password, with the signed-in name displayed as `@username`; email/Gmail is not an account identifier. Android biometric sign-in may be enabled after onboarding, with password fallback. Voice is speech-to-text input only: users review and edit the transcript before sending; the app does not speak replies.

Chats, memories, journals, and wellbeing entries are local-first and do not sync automatically between devices. Journal or wellbeing content is not included in AI context unless the user explicitly chooses to share selected content. Password recovery does not restore local history or encryption keys on another device.

## Developer setup
Requirements: Node.js 22.12 or newer.

```sh
cd client
npm ci
npm run web
```

The browser preview is for local development. For desktop packaging, the internal renderer is bundled into Electron; it is not a hosted web app or browser download.

## Platform packaging
Current package targets: Android ARM64 APK; Windows x64 and ARM64 installers; macOS Apple Silicon and Intel DMGs; Linux x64 DEB and AppImage. iOS/iPhone/iPad and standalone web are not currently offered. Package format validation does not replace install/launch tests, signing, notarization, or store certification.

Common commands:

```sh
npm run android
npm run build:web
npm run build:dist
npm run desktop:windows
npm run desktop:macos
npm run desktop:linux
```

Run client tests with `npm test -- --runInBand`, type-check with `npx tsc --noEmit`, and lint with `npm run lint`.

## AI routing and usage
The gateway routes text and image requests server-side to the configured models. The published Free allowance is 40 credits per UTC day; each text or image request costs one credit. This is a usage limit, not exact provider-cost accounting or a promise of permanent free access. Model availability, quality, provider terms, and costs may change.

## Verification
Automated checks confirm only what they exercise. Test authentication, recovery, biometric unlock, data persistence, backups, accessibility, chat streaming, image attachment, and offline/error states on supported devices before describing the release as fully verified.
