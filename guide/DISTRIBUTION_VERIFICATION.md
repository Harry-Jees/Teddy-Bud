# Distribution verification

The distribution workflow builds and collects a deliberately small, current package set. It removes stale platform folders before collecting artifacts and verifies the actual package payloads (not just file existence) before publishing them.

Run locally after collecting a complete CI artifact:

```sh
python scripts/verify_distributions.py
```

The verifier rejects Git LFS pointer text, implausibly small files, invalid package signatures, missing payloads, and any unexpected or stale file. CI runs it before uploading the combined `teddy-bud-dist` artifact or committing the refreshed `dist/` folder.

## Published package set

| File | Target | Validation |
| --- | --- | --- |
| `android/TeddyBud.v.1.0-Android-arm64.apk` | ARM64 Android | ZIP CRC, manifest, DEX, native ABI |
| `desktop/TeddyBud.v.1.0-win-x64.exe` | Windows x64 | PE executable signature |
| `desktop/TeddyBud.v.1.0-win-x64.exe.blockmap` | Windows updater metadata | Non-empty companion file |
| `desktop/TeddyBud.v.1.0-mac-arm64.dmg` | Apple Silicon macOS installer | DMG UDIF footer |
| `desktop/TeddyBud.v.1.0-mac-arm64.zip` | Apple Silicon macOS ZIP | ZIP CRC and `.app` bundle |
| `desktop/TeddyBud.v.1.0-linux-amd64.deb` | Debian/Ubuntu x64 | Debian archive header |
| `desktop/TeddyBud.v.1.0-linux-amd64.AppImage` | Linux x64 | ELF header and executable bit |

Windows intentionally has one installer choice. macOS offers a DMG installer and a ZIP archive for Apple Silicon; Linux offers DEB and AppImage. Intel macOS, iOS Simulator, and native iPhone/iPad packages are not advertised as available downloads.

## iPhone/iPad status

A normal installable iOS release requires a device-targeted build signed with an Apple Developer Team and an appropriate provisioning profile (or a supported distribution channel such as TestFlight/App Store). The Simulator archive is not an installable iPhone app. No signed IPA is published until the required Apple signing credentials and provisioning setup are configured.

## Scope and limitations

These checks confirm file formats and structural integrity. They do not replace installation and launch tests on each target operating system, code signing, macOS notarization, or store certification. Windows/macOS packages remain development builds unless signing and release steps are completed.
