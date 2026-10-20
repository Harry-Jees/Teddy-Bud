# Teddy Bud

Teddy Bud is a private, supportive conversation app for web, mobile, and desktop. It uses React Native for native Android, iOS, and macOS apps, and React Native Web for browsers. Windows, macOS, and Linux desktop packages use Electron.

## Get started

Requirements: Node.js 22.12 or newer.

```sh
cd client
npm ci
npm run web
```

The development site opens at `http://127.0.0.1:5173/`. For the gateway Worker, install its dependencies and run its tests separately:

```sh
cd gateway-worker
npm ci
npm test
```

## Platform packages

Committed build outputs are under `dist/`:

| Platform | Artifact | Build type |
| --- | --- | --- |
| Web | `dist/web/` | Static web app and installable web manifest |
| Android | `dist/android/TeddyBud-android-debug.apk` | Debug APK for ARM64 Android devices |
| iOS | `dist/ios/TeddyBud-ios.zip` | iOS Simulator app bundle |
| macOS native | `dist/macos/TeddyBud-macos.zip` | macOS app bundle |
| Windows desktop | `dist/desktop/Teddy-Bud-1.0.0-win-x64.exe` and matching `.nsis.7z` payload | x64 NSIS installer package |
| macOS desktop | `dist/desktop/Teddy-Bud-1.0.0-mac-arm64.dmg` | Apple Silicon Electron disk image |
| Linux desktop | `dist/desktop/Teddy-Bud-1.0.0-linux-amd64.deb` | x64 Debian package |

These are development builds. Android and Apple native outputs are not store submissions; Windows and macOS desktop builds need signing for trusted public distribution. See the [distribution verification record](guide/DISTRIBUTION_VERIFICATION.md) for artifact checks and platform-specific use requirements.

`dist/` is a committed snapshot of packaged outputs, not files embedded in the
source app. GitHub Actions rebuilds packages from the triggering source commit,
checks their formats, then refreshes this snapshot. Check the latest successful
workflow run to confirm the snapshot matches current source. The iOS ZIP is a
Simulator build, not an iPhone store package.

## Repository map

| Path | Contents |
| --- | --- |
| `client/` | React Native app, web entry point, platform projects, desktop wrapper, and client tests |
| `gateway-worker/` | Cloudflare Worker for password authentication, recovery, sessions, and authenticated model requests |
| `supabase/migrations/` | Database schema migrations for user profiles |
| `guide/` | Product, architecture, design, security, release, and verification documentation |
| `dist/` | Collected platform distributions |
| `scripts/` | Repository-level distribution verification |
| `.github/workflows/` | CI checks and platform build workflow |

## Common commands

Run these from `client/` unless the command says otherwise:

| Purpose | Command |
| --- | --- |
| Run web app | `npm run web` |
| Client tests | `npm test -- --runInBand` |
| TypeScript check | `npx tsc --noEmit` |
| Build web distribution | `npm run build:web` |
| Build desktop package for current OS | `npm run build:dist` |
| Build Windows installer | `npm run desktop:windows` |
| Build macOS disk image | `npm run desktop:macos` |
| Build Linux Debian package | `npm run desktop:linux` |

Run Worker tests from `gateway-worker/` with `npm test`. The collected artifact checks can be run from the repository root with `python scripts/verify_distributions.py`.

## Configuration and product behavior

The app uses email/password accounts with user-chosen recovery passphrases and one-hour sessions. Email is an account identifier; no email verification or auth email delivery is required. Each account has separate locally encrypted chat data on a device. Gateway setup, Supabase configuration, allowed browser origins, and secret configuration are documented in [gateway-worker/README.md](gateway-worker/README.md). Do not place credentials in the app bundle or commit them to the repository.

The [client README](client/README.md) documents setup, account configuration, local data, and privacy settings. The [guide index](guide/README.md) links to product and engineering documentation, including the [security and privacy model](guide/SECURITY_AND_PRIVACY.md).
