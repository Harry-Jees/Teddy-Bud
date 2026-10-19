# Distribution verification

This record describes the platform scope and format checks for the collected files in `dist/`. The baseline artifact observations below were made on 2026-10-20, before the shared 1.0 release rebuild. The collection workflow now clears the previous `dist/` snapshot before adding outputs, and runs the automated verifier before publishing the combined artifact.

```sh
python scripts/verify_distributions.py
```

CI runs the same check after collecting all platform artifacts and before uploading the combined distribution.

## Platform inventory

| Artifact | Intended use | Checks performed | Baseline observation |
| --- | --- | --- | --- |
| `web/` | Browser and installable web app | HTML entry point and referenced local assets | Entry point references the current bundle and its supporting assets. Unreferenced older hashed app bundles have been removed. |
| `android/TeddyBud-android-debug.apk` | ARM64 Android debug build | ZIP CRC, Android package metadata, launcher activity, SDK levels, and native ABI | APK structure and package metadata are valid. It is debuggable, targets ARM64 (`arm64-v8a`), has minimum SDK 24 and target SDK 36. No Android device was attached for an install-and-launch check. |
| `ios/TeddyBud-ios.zip` | iOS Simulator build | ZIP CRC, app bundle, executable, and `Info.plist` | Valid simulator app bundle; metadata identifies `iPhoneSimulator` and minimum iOS 15.1. It is for Simulator use, not direct installation on a physical iPhone. |
| `macos/TeddyBud-macos.zip` | Native macOS app build | ZIP CRC, app bundle, executable, and `Info.plist` | Valid macOS app bundle with `MacOSX` platform metadata. macOS execution requires a Mac. |
| `desktop/Teddy-Bud-1.0.0-win-x64.exe` and `teddy-bud-desktop-1.0.0-x64.nsis.7z` | Windows x64 Electron package | PE executable signature, 7z payload integrity, and blockmap format | Windows installation was not run in this environment. |
| `desktop/Teddy-Bud-1.0.0-mac-arm64.dmg` | Apple Silicon Electron disk image | DMG footer and format header | The previous committed snapshot had a Git LFS pointer header in place of its disk image header; the regenerated artifact is checked by CI. |
| `desktop/Teddy-Bud-1.0.0-linux-amd64.deb` | x64 Debian package | Debian `ar` package header and member structure | The previous committed snapshot had a Git LFS pointer header in place of its Debian package header; the regenerated artifact is checked by CI. |

The development environment used for the baseline inspection was Windows. Native iOS/macOS launch checks require macOS; Android installation checks require an attached device or emulator. CI builds the Apple, Android, Windows, and Linux artifacts on their corresponding hosted runners.

## Version metadata

The shared app version is `1.0`. Native Android, iOS, and macOS metadata use `1.0`; Electron packaging uses semver `1.0.0`, the package-manager form of that release version. The Android version code and Apple build numbers remain `1`.

## Release readiness

The client test suite, Worker test suite, and TypeScript check passed during the baseline review: 54 client tests, 12 Worker tests, and `tsc --noEmit`. The local Vite build command requires Node.js 20.19+ or 22.12+; this machine provided Node.js 20.16.0. The client README specifies Node.js 22.12 or newer.

The package format verifier checks structural signatures and archive contents. It does not replace signing, notarization, platform installation, or runtime checks on each target OS. Public distribution also requires the signing credentials described in [client/README.md](../client/README.md).
