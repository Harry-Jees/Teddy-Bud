#!/usr/bin/env python3
"""Validate Teddy Bud V 1.0 platform release packages."""
from __future__ import annotations
import os
import struct
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
errors: list[str] = []

def require(ok: bool, message: str) -> None:
    if not ok:
        errors.append(message)

def verify_apk() -> None:
    path = DIST / "android" / "TeddyBud.v.1.0-Android-arm64.apk"
    require(path.is_file(), f"Missing APK: {path}")
    if not path.is_file():
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
    path = DIST / "desktop" / "TeddyBud.v.1.0-win-x64.exe"
    require(path.is_file(), f"Missing Windows installer: {path}")
    if path.is_file():
        with path.open("rb") as stream:
            header = stream.read(64)
            valid = header[:2] == b"MZ" and len(header) >= 64
            if valid:
                stream.seek(struct.unpack("<I", header[60:64])[0])
                valid = stream.read(4) == b"PE\0\0"
            require(valid, "Windows installer has invalid PE signature")
    blockmap = DIST / "desktop" / "TeddyBud.v.1.0-win-x64.exe.blockmap"
    require(blockmap.is_file(), f"Missing Windows blockmap: {blockmap}")

def verify_dmg(filename: str, required: bool) -> None:
    path = DIST / "desktop" / filename
    if not required and not path.exists():
        return
    require(path.is_file(), f"Missing macOS DMG: {filename}")
    if path.is_file():
        with path.open("rb") as stream:
            size = path.stat().st_size
            prefix = stream.read(64)
            footer = b""
            if size >= 512:
                stream.seek(-512, 2)
                footer = stream.read(512)
        require(not prefix.startswith(b"version https://git-lfs.github.com/spec/"), f"{filename} is an LFS pointer, not a DMG")
        require(footer[:4] == b"koly", f"{filename} has no UDIF footer")

def verify_deb() -> None:
    path = DIST / "desktop" / "TeddyBud.v.1.0-linux-x64.deb"
    require(path.is_file(), f"Missing Debian package: {path}")
    if path.is_file():
        with path.open("rb") as stream:
            require(stream.read(8) == b"!<arch>\n", "Linux DEB has an invalid ar header")

def verify_appimage() -> None:
    path = DIST / "desktop" / "TeddyBud.v.1.0-linux-x64.AppImage"
    require(path.is_file(), f"Missing Linux AppImage: {path}")
    if path.is_file():
        with path.open("rb") as stream:
            require(stream.read(4) == b"\x7fELF", "Linux AppImage has no ELF executable header")
        require(os.access(path, os.X_OK), "Linux AppImage is not executable")

def main() -> int:
    verify_apk()
    verify_windows()
    verify_dmg("TeddyBud.v.1.0-mac-arm64.dmg", required=True)
    verify_dmg("TeddyBud.v.1.0-mac-x64.dmg", required=True)
    verify_deb()
    verify_appimage()
    require(not (DIST / "ios").exists(), "Unexpected iOS distribution directory")
    require(not (DIST / "web").exists(), "Unexpected web distribution directory")
    require(not (DIST / "macos").exists(), "Unexpected duplicate macOS ZIP distribution directory")
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print("All Teddy Bud V 1.0 distribution checks passed.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
