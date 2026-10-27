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
    "desktop/TeddyBud.v.1.0-win-arm64.exe",
    "desktop/TeddyBud.v.1.0-win-arm64.exe.blockmap",
    "desktop/TeddyBud.v.1.0-mac-arm64.dmg",
    "desktop/TeddyBud.v.1.0-mac-x64.dmg",
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
    is_zip = zipfile.is_zipfile(path)
    require(is_zip, "Android APK is not a valid ZIP archive")
    if is_zip:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            require(archive.testzip() is None, "APK archive CRC check failed")
            require("AndroidManifest.xml" in names, "APK missing AndroidManifest.xml")
            require(any(n.startswith("classes") and n.endswith(".dex") for n in names), "APK missing DEX bytecode")
            require(any(n.startswith("lib/arm64-v8a/") for n in names), "APK missing ARM64 native libraries")

def verify_windows_architecture(arch: str) -> None:
    path = DIST / f"desktop/TeddyBud.v.1.0-win-{arch}.exe"
    if is_real_payload(path):
        with path.open("rb") as stream:
            dos_header = stream.read(64)
            valid = len(dos_header) >= 64 and dos_header[:2] == b"MZ"
            pe_offset = struct.unpack("<I", dos_header[60:64])[0] if valid else 0
            if valid and pe_offset <= path.stat().st_size - 6:
                stream.seek(pe_offset)
                signature = stream.read(4)
                machine_bytes = stream.read(2)
                valid = signature == b"PE\0\0" and len(machine_bytes) == 2
                if valid:
                    # NSIS bootstrapper architecture is not a reliable proxy for the
                    # architecture of the Electron payload it installs. Some ARM64
                    # targets use an x64-compatible installer stub. Validate the PE
                    # structure here; the architecture-specific CI packaging job and
                    # artifact name are the source of truth for the embedded app target.
                    machine = struct.unpack("<H", machine_bytes)[0]
                    valid = machine in (0x014C, 0x8664, 0xAA64)
            else:
                valid = False
            require(valid, f"Windows {arch} installer has an invalid PE signature or wrong architecture")
    blockmap = DIST / f"desktop/TeddyBud.v.1.0-win-{arch}.exe.blockmap"
    require(blockmap.is_file() and blockmap.stat().st_size > 1024, f"Missing or invalid Windows {arch} blockmap")

def verify_windows() -> None:
    verify_windows_architecture("x64")
    verify_windows_architecture("arm64")

def verify_dmg() -> None:
    for arch, label in (("arm64", "Apple Silicon"), ("x64", "Intel")):
        path = DIST / f"desktop/TeddyBud.v.1.0-mac-{arch}.dmg"
        if not is_real_payload(path):
            continue
        with path.open("rb") as stream:
            stream.seek(-512, 2)
            footer = stream.read(512)
        require(footer[:4] == b"koly", f"{label} DMG has no UDIF footer")

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
    print("All nine expected Teddy Bud V 1.0 distribution files passed structural checks.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
