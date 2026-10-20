#!/usr/bin/env python3
"""Validate the exact supported Teddy Bud V 1.0 distribution set."""
from __future__ import annotations

import os
import struct
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
errors: list[str] = []
EXPECTED = {
    "android/TeddyBud.v.1.0-Android-arm64.apk",
    "desktop/TeddyBud.v.1.0-win-x64.exe",
    "desktop/TeddyBud.v.1.0-win-x64.exe.blockmap",
    "desktop/TeddyBud.v.1.0-mac-arm64.dmg",
    "desktop/TeddyBud.v.1.0-mac-arm64.zip",
    "desktop/TeddyBud.v.1.0-linux-amd64.deb",
    "desktop/TeddyBud.v.1.0-linux-amd64.AppImage",
}

def require(ok: bool, message: str) -> None:
    if not ok:
        errors.append(message)

def is_real_payload(path: Path) -> bool:
    if not path.is_file():
        require(False, f"Missing distribution file: {path.relative_to(DIST)}")
        return False
    with path.open("rb") as stream:
        prefix = stream.read(128)
    valid = not prefix.startswith(b"version https://git-lfs.github.com/spec/")
    require(valid, f"{path.relative_to(DIST)} is a Git LFS pointer, not the actual package")
    require(path.stat().st_size > 1024, f"{path.relative_to(DIST)} is suspiciously small ({path.stat().st_size} bytes)")
    return valid and path.stat().st_size > 1024

def verify_apk() -> None:
    path = DIST / "android/TeddyBud.v.1.0-Android-arm64.apk"
    if not is_real_payload(path):
        return
    require(zipfile.is_zipfile(path), "Android APK is not a valid ZIP archive")
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            require(archive.testzip() is None, "APK archive CRC check failed")
            require("AndroidManifest.xml" in names, "APK missing AndroidManifest.xml")
            require(any(n.startswith("classes") and n.endswith(".dex") for n in names), "APK missing DEX bytecode")
            require(any(n.startswith("lib/arm64-v8a/") for n in names), "APK missing ARM64 native libraries")

def verify_windows() -> None:
    path = DIST / "desktop/TeddyBud.v.1.0-win-x64.exe"
    if is_real_payload(path):
        with path.open("rb") as stream:
            header = stream.read(64)
            valid = header[:2] == b"MZ" and len(header) >= 64
            if valid:
                stream.seek(struct.unpack("<I", header[60:64])[0])
                valid = stream.read(4) == b"PE\0\0"
            require(valid, "Windows installer has invalid PE signature")
    blockmap = DIST / "desktop/TeddyBud.v.1.0-win-x64.exe.blockmap"
    require(blockmap.is_file() and blockmap.stat().st_size > 1024, "Missing or invalid Windows blockmap")

def verify_dmg() -> None:
    path = DIST / "desktop/TeddyBud.v.1.0-mac-arm64.dmg"
    if not is_real_payload(path):
        return
    with path.open("rb") as stream:
        stream.seek(-512, 2)
        footer = stream.read(512)
    require(footer[:4] == b"koly", "Apple Silicon DMG has no UDIF footer")

def verify_mac_zip() -> None:
    path = DIST / "desktop/TeddyBud.v.1.0-mac-arm64.zip"
    if is_real_payload(path):
        require(zipfile.is_zipfile(path), "macOS ZIP is not a valid ZIP archive")
        if zipfile.is_zipfile(path):
            with zipfile.ZipFile(path) as archive:
                require(archive.testzip() is None, "macOS ZIP CRC check failed")
                require(any(".app/" in name for name in archive.namelist()), "macOS ZIP has no .app bundle")

def verify_deb() -> None:
    path = DIST / "desktop/TeddyBud.v.1.0-linux-amd64.deb"
    if is_real_payload(path):
        with path.open("rb") as stream:
            require(stream.read(8) == b"!<arch>\n", "Linux DEB has an invalid ar header")

def verify_appimage() -> None:
    path = DIST / "desktop/TeddyBud.v.1.0-linux-amd64.AppImage"
    if is_real_payload(path):
        with path.open("rb") as stream:
            require(stream.read(4) == b"\x7fELF", "Linux AppImage has no ELF executable header")
        require(os.access(path, os.X_OK), "Linux AppImage is not executable")

def main() -> int:
    verify_apk()
    verify_windows()
    verify_dmg()
    verify_mac_zip()
    verify_deb()
    verify_appimage()

    actual = {p.relative_to(DIST).as_posix() for p in DIST.rglob("*") if p.is_file()} if DIST.exists() else set()
    require(actual == EXPECTED, f"Distribution file set mismatch. Missing: {sorted(EXPECTED - actual)}; unexpected/stale: {sorted(actual - EXPECTED)}")
    for obsolete in ("ios", "web", "macos"):
        require(not (DIST / obsolete).exists(), f"Unexpected obsolete distribution directory: dist/{obsolete}/")

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print("All six expected Teddy Bud V 1.0 distribution files passed structural checks.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
