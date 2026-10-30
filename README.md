# Teddy Bud

<p align="center">
  <strong>A little room to breathe.</strong><br />
  A private, supportive AI companion for everyday conversations.
</p>

<p align="center">
  <a href="https://teddybud.vercel.app/">Official website & portfolio</a> ·
  <a href="https://github.com/Harry-Jees/Teddy-Bud">Source repository</a> ·
  <a href="https://github.com/Harry-Jees/Teddy-Bud/issues">Feedback & bug reports</a>
</p>

---

## Meet Teddy Bud

Teddy Bud is an AI conversation companion built to give people a calmer, more personal place to talk, reflect, and feel heard. It is designed around a simple idea: technology should make room for people—not make their private lives feel like product data.

Whether someone wants to talk through a difficult day, organize their thoughts, revisit a meaningful moment, or simply have a friendly conversation, Teddy Bud aims to respond with warmth and care in a clean, approachable interface.

Teddy Bud is an AI companion, not a therapist, emergency service, or substitute for professional mental-health care. AI responses can be mistaken or incomplete.

## What it is for

- **Everyday conversation:** chat naturally with an AI companion.
- **Image conversations:** attach an image and ask your companion about it.
- **Free launch allowance:** 40 credits per day; each text or image message costs one credit.
- **Industrial / Enterprise option:** locally hosted model routing is planned for organizations that need their own inference infrastructure.
- **A place to reflect:** revisit conversations and keep selected memories that matter to you.
- **User-controlled memory:** review, edit, or remove saved memories rather than treating every detail as something that must be retained.
- **Privacy-conscious design:** conversations and approved memories are stored locally with encryption appropriate to the platform.
- **Choice over shared context:** privacy controls determine which saved memories or excerpts may be included with a message sent to the AI provider.
- **Cross-platform native experience:** use the Android app or a supported Windows, macOS, or Linux desktop package.

## Privacy by design

Teddy Bud is designed to minimize unnecessary collection and keep personal conversation data under the user's control.

- Chats, preferences, and approved memories are stored locally on the device.
- Local data protection uses platform-appropriate encryption and account-scoped keys.
- Authentication and AI requests go through the configured gateway; provider credentials stay server-side.
- Only the conversation and optional context selected by the app's behavior and privacy settings are sent to the AI service for a response.
- Password recovery does not magically restore local chat history or transfer encryption keys to another device.

These protections reduce risk but do not mean that data is inaccessible to all software while the app is unlocked. Review the [Security and Privacy guide](guide/SECURITY_AND_PRIVACY.md) before relying on the app for sensitive information.

## Where to use Teddy Bud

| Platform | Current availability |
| --- | --- |
| Web | **Not offered as a standalone app or download** |
| Android | ARM64 APK in `dist/android/` |
| Windows | x64 and ARM64 desktop installers in `dist/desktop/` |
| macOS | Apple Silicon DMG installer in `dist/desktop/` |
| Linux | x64 Debian package and AppImage in `dist/desktop/` |
| iOS / iPhone | **Not currently available** |

The configured distribution set is Android ARM64 APK, Windows x64 and ARM64 installers, macOS Apple Silicon and Intel DMGs, and Linux x64 DEB/AppImage packages. There is no standalone web app, no web download, and no iPhone/iPad installer. Downloads are development builds and may not be signed for trusted public distribution. See [Distribution verification](guide/DISTRIBUTION_VERIFICATION.md) for the exact package set and validation limits. The product direction is documented in [the feature roadmap](docs/MAJOR_UPGRADE_ROADMAP.md).

For the product's public-facing presentation, visit the [Teddy Bud portfolio website](https://teddybud.vercel.app/). This is a portfolio/presentation site, not a web version of the Teddy Bud app.

## Getting started for developers

Requirements: Node.js 22.12 or newer.

```sh
cd client
npm ci
npm run web
```

For desktop packaging, the build system creates an internal web-rendered bundle that is loaded by Electron. This is an implementation detail of the desktop app, not a standalone web product.

Run gateway Worker tests separately:

```sh
cd gateway-worker
npm ci
npm test
```

### Common commands

Run client commands from `client/`:

| Purpose | Command |
| --- | --- |
| Run local browser preview (development only) | `npm run web` |
| Client tests | `npm test -- --runInBand` |
| TypeScript check | `npx tsc --noEmit` |
| Build internal renderer bundle (used by desktop packaging) | `npm run build:web` |
| Build desktop package for current OS | `npm run build:dist` |
| Build Windows installer | `npm run desktop:windows` |
| Build macOS disk image | `npm run desktop:macos` |
| Build Linux packages | `npm run desktop:linux` |

Run `python scripts/verify_distributions.py` from the repository root to check collected distribution artifacts.

## How the repository is organized

| Path | Purpose |
| --- | --- |
| `client/` | React Native app, internal web renderer for desktop packaging, desktop wrapper, and client tests |
| `gateway-worker/` | Cloudflare Worker for account sessions, recovery, and authenticated AI requests |
| `supabase/migrations/` | Database schema migrations |
| `guide/` | Product, architecture, UI, privacy, release, and distribution documentation |
| `dist/` | Collected platform packages |
| `scripts/` | Distribution verification tools |
| `.github/workflows/` | CI and platform packaging workflow; no website deployment workflow |

## Documentation and community

- [Product requirements](guide/PRD.md)
- [Technical architecture](guide/TECHNICAL_ARCHITECTURE.md)
- [Security and privacy](guide/SECURITY_AND_PRIVACY.md)
- [Distribution verification](guide/DISTRIBUTION_VERIFICATION.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security reporting](SECURITY.md)
- [Support](SUPPORT.md)

## Project status and licensing

Teddy Bud is under active development. Build success confirms packaging and automated checks, not complete real-device validation or store approval.

**No license is currently declared in this repository.** Public visibility does not itself grant permission to reuse or redistribute the code. A license should be selected by the project owner before the repository is described as open source.
