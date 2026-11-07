# Teddy Bud

<p align="center">
  <strong>A little room to breathe.</strong><br />
  A private, supportive AI companion for everyday conversations.
</p>

<p align="center">
  <a href="https://teddybud.vercel.app/">Product website</a> ·
  <a href="https://github.com/Harry-Jees/Teddy-Bud">Source repository</a> ·
  <a href="https://github.com/Harry-Jees/Teddy-Bud/issues">Feedback & bug reports</a>
</p>

---

## The product

Teddy Bud is a calm, personal AI companion for talking things through, reflecting, and returning to conversations that matter. It should feel warm and reassuring—not like a generic AI dashboard, a clinical tool, or a childish character app.

The product principle is **“A little room to breathe.”** The interface uses a soft, mature claymorphism language with Material 3 foundations, warm ivory and cocoa tones, clear hierarchy, purposeful motion, and an 8-point spacing rhythm. Keep the experience uncluttered and accessible. There is no dark mode.

Teddy Bud is an AI companion, not a therapist, emergency service, or substitute for professional care. Responses can be mistaken or incomplete.

## Product requirements

- **Conversation first:** natural text conversations, streaming responses, history, and clear retry/error states.
- **Contextual Teddy stickers:** nine separate bundled sticker poses can accompany an assistant reply when the moment fits; they are not a user-facing sticker picker and are suppressed for crisis-support conversations.
- **Image understanding:** users can attach supported images and discuss them in chat.
- **Voice input only:** speech-to-text is a composer aid. Users review and edit recognized text before sending. Teddy Bud does not speak replies or provide voice playback.
- **Local-first personal data:** chats, memories, journals, and wellbeing entries stay on the device. They are not silently synchronized between devices.
- **Explicit AI context:** only the current conversation and context allowed by the user's controls are sent to the AI gateway. Journal and wellbeing content is not included automatically.
- **Memory control:** users can review and manage saved memories and decide whether to share them with a request.
- **One account per device:** account access uses a username and password, not an email/Gmail address. The app displays the account as `@username`. Password recovery uses the user's recovery passphrase; it does not restore local history or encryption keys on another device.
- **Android biometric sign-in:** after onboarding is completed, users may enable device biometrics for convenient sign-in. Password sign-in remains available.
- **Free-first launch:** the published allowance is 40 credits per UTC day; text and image requests each cost one credit. This is a usage allowance, not a guarantee of exact provider cost or permanent free access.
- **Soft, focused UI:** clear, accessible touch targets; responsive mobile and desktop layouts; useful motion without clutter; no exaggerated or distracting effects.

## Navigation and scope

The app's primary navigation stays compact: **Chats**, **Discover**, **Memories**, and **Settings**. There is no oversized central **+** action. Journal, emotional check-ins, the emotion web, guided wellbeing exercises, chat history, and privacy controls belong in Discover. Keep the app focused on companion conversation and personal reflection rather than adding generic document or productivity features.

Teddy Bud is distributed as an Android app and supported desktop packages. The internal React Native Web renderer is used for development and Electron packaging only; it is not a standalone web app. The separate portfolio website is a presentation site, not the app.

| Platform | Status |
| --- | --- |
| Android | ARM64 development APK |
| Windows | x64 and ARM64 desktop installers |
| macOS | Apple Silicon and Intel DMGs |
| Linux | x64 Debian package and AppImage |
| Standalone web app | Not offered |
| iOS / iPhone / iPad | Not currently offered |

Build success and package verification do not replace installation, accessibility, security, or real-device testing. Development packages may not be signed for public distribution.

## Privacy and safety

- Local data is protected using platform-appropriate encrypted storage.
- Authentication and AI requests use the configured gateway; provider credentials remain server-side.
- Users choose whether saved memory or other permitted context is included with an AI request.
- Password recovery does not recover another device's local database key or conversation history.
- Do not describe the app as end-to-end encrypted: the remote model must receive readable prompt content to generate a response.
- Do not claim clinical, diagnostic, or emergency capabilities.

See [Security and Privacy](guide/SECURITY_AND_PRIVACY.md), [Product Requirements](guide/PRD.md), and [UI/UX Guidelines](guide/UI_UX_GUIDELINES.md).

## Developer setup

Requirements: Node.js 22.12 or newer.

```sh
cd client
npm ci
npm run web
```

The browser preview is for development only. For desktop packaging, use the platform scripts in `client/package.json`. Run gateway tests from `gateway-worker/`:

```sh
npm ci
npm test
```

## Repository map

| Path | Purpose |
| --- | --- |
| `client/` | React Native app, internal renderer, desktop wrapper, and client tests |
| `gateway-worker/` | Cloudflare Worker for account sessions and authenticated AI requests |
| `supabase/migrations/` | Database migrations used by the gateway |
| `guide/` | Product, architecture, privacy, UI, release, and distribution documentation |
| `docs/` | Feature status, acceptance criteria, and upgrade plans |
| `dist/` | Generated packages are ignored by Git and published as GitHub Release assets after successful CI |
| `.github/workflows/` | CI, packaging, and guarded deployment workflows |

## Status and license

Teddy Bud is under active development. Automated checks validate code and packaging; they do not prove every feature works on every device. See [Distribution Verification](guide/DISTRIBUTION_VERIFICATION.md) for package checks and their limitations.

No license is currently declared. Public visibility does not itself grant permission to reuse or redistribute the code.
