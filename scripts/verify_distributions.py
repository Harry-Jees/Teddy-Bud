#!/usr/bin/env python3
"""Check the structure and format of Teddy Bud's collected distributions."""

from __future__ import annotations

import gzip
import json
import plistlib
import struct
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
errors: list[str] = []
MACH_O_MAGICS = {
    b"\xfe\xed\xfa\xce",
    b"\xce\xfa\xed\xfe",
    b"\xfe\xed\xfa\xcf",
    b"\xcf\xfa\xed\xfe",
    b"\xca\xfe\xba\xbe",
    b"\xbe\xba\xfe\xca",
    b"\xca\xfe\xba\xbf",
    b"\xbf\xba\xfe\xca",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def check_zip(path: Path) -> list[str]:
    require(path.is_file(), f"Missing archive: {path.relative_to(ROOT)}")
    if not path.is_file() or not zipfile.is_zipfile(path):
        errors.append(f"Not a readable ZIP archive: {path.relative_to(ROOT)}")
        return []
    try:
        with zipfile.ZipFile(path) as archive:
            bad_entry = archive.testzip()
            require(bad_entry is None, f"ZIP CRC error in {path.relative_to(ROOT)}: {bad_entry}")
            return archive.namelist()
    except (OSError, zipfile.BadZipFile) as exc:
        errors.append(f"Cannot inspect {path.relative_to(ROOT)}: {exc}")
        return []


def plist_from_archive(path: Path, member: str) -> dict:
    try:
        with zipfile.ZipFile(path) as archive:
            value = plistlib.loads(archive.read(member))
            return value if isinstance(value, dict) else {}
    except (OSError, KeyError, zipfile.BadZipFile, plistlib.InvalidFileException) as exc:
        errors.append(f"Cannot read {member} from {path.relative_to(ROOT)}: {exc}")
        return {}


class LocalAssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.paths: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key in {"src", "href"} and value:
                self.paths.append(value)


def verify_web() -> None:
    index = DIST / "web" / "index.html"
    require(index.is_file(), "Missing web entry point: dist/web/index.html")
    if not index.is_file():
        return
    parser = LocalAssetParser()
    source = index.read_text(encoding="utf-8")
    parser.feed(source)
    for raw_path in parser.paths:
        parsed = urlparse(raw_path)
        if parsed.scheme or parsed.netloc or raw_path.startswith("#"):
            continue
        local_path = parsed.path.lstrip("/") if parsed.path.startswith("/") else parsed.path
        asset = (index.parent / local_path).resolve()
        require(asset.is_relative_to(index.parent.resolve()) and asset.is_file(), f"Missing or invalid web asset: {raw_path}")

    referenced_text = source
    for asset in (index.parent / "assets").glob("*.js"):
        referenced_text += asset.read_text(encoding="utf-8", errors="ignore")
    for app_bundle in (index.parent / "assets").glob("index-*.js"):
        require(app_bundle.name in referenced_text, f"Unreferenced web bundle: {app_bundle.relative_to(ROOT)}")

    manifest_path = index.parent / "manifest.webmanifest"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Cannot read web manifest: {exc}")
        return
    for icon in manifest.get("icons", []):
        icon_path = icon.get("src") if isinstance(icon, dict) else None
        if not icon_path:
            errors.append("Web manifest has an icon entry without a source path")
            continue
        parsed = urlparse(icon_path)
        if parsed.scheme or parsed.netloc:
            continue
        local_path = parsed.path.lstrip("/") if parsed.path.startswith("/") else parsed.path
        asset = (manifest_path.parent / local_path).resolve()
        require(asset.is_relative_to(manifest_path.parent.resolve()) and asset.is_file(), f"Missing or invalid web manifest icon: {icon_path}")
        if asset.is_file():
            with asset.open("rb") as stream:
                require(stream.read(8) == b"\x89PNG\r\n\x1a\n", f"Web manifest icon is not a PNG: {icon_path}")


def verify_android() -> None:
    path = DIST / "android" / "TeddyBud-android-debug.apk"
    entries = check_zip(path)
    require("AndroidManifest.xml" in entries, "Android APK has no AndroidManifest.xml")
    require(any(name.startswith("classes") and name.endswith(".dex") for name in entries), "Android APK has no DEX bytecode")
    require(any(name.startswith("lib/arm64-v8a/") for name in entries), "Android APK has no ARM64 native libraries")


def verify_apple_zip(relative_path: str, expected_platform: str, info_path: str) -> None:
    path = DIST / relative_path
    entries = check_zip(path)
    info = plist_from_archive(path, info_path)
    require(info.get("CFBundleSupportedPlatforms") == [expected_platform], f"Unexpected Apple platform metadata in {relative_path}")
    require(info.get("CFBundlePackageType") == "APPL", f"Apple bundle is not marked as an application in {relative_path}")
    executable = info.get("CFBundleExecutable")
    if executable:
        app_root = info_path.split("/Contents/", 1)[0] if "/Contents/" in info_path else info_path.rsplit("/", 1)[0]
        executable_path = f"{app_root}/Contents/MacOS/{executable}" if expected_platform == "MacOSX" else f"{app_root}/{executable}"
        require(executable_path in entries, f"Missing app executable in {relative_path}")
        try:
            with zipfile.ZipFile(path) as archive:
                signature = archive.read(executable_path)[:4]
            require(signature in MACH_O_MAGICS, f"Apple app executable is not Mach-O in {relative_path}")
        except (OSError, KeyError, zipfile.BadZipFile) as exc:
            errors.append(f"Cannot inspect app executable in {relative_path}: {exc}")


def verify_windows() -> None:
    installer = DIST / "desktop" / "Teddy-Bud-1.0.0-win-x64.exe"
    blockmap = DIST / "desktop" / "Teddy-Bud-1.0.0-win-x64.exe.blockmap"
    for path in (installer, blockmap):
        require(path.is_file(), f"Missing Windows package file: {path.relative_to(ROOT)}")
    if installer.is_file():
        with installer.open("rb") as stream:
            header = stream.read(64)
            valid_dos_header = header[:2] == b"MZ" and len(header) >= 64
            if valid_dos_header:
                pe_offset = struct.unpack("<I", header[60:64])[0]
                stream.seek(pe_offset)
                valid_pe_header = stream.read(4) == b"PE\0\0"
            else:
                valid_pe_header = False
            require(valid_pe_header, "Windows installer does not have a valid PE signature")
    if blockmap.is_file():
        with blockmap.open("rb") as stream:
            require(stream.read(2) == b"\x1f\x8b", "Windows blockmap is not gzip-compressed")
            stream.seek(0)
            try:
                gzip.decompress(stream.read())
            except (OSError, EOFError):
                errors.append("Windows blockmap gzip stream is invalid")


def verify_dmg() -> None:
    path = DIST / "desktop" / "Teddy-Bud-1.0.0-mac-arm64.dmg"
    require(path.is_file(), f"Missing macOS desktop disk image: {path.relative_to(ROOT)}")
    if not path.is_file():
        return
    size = path.stat().st_size
    with path.open("rb") as stream:
        prefix = stream.read(64)
        if size >= 512:
            stream.seek(-512, 2)
            footer = stream.read(512)
        else:
            footer = b""
    require(not prefix.startswith(b"version https://git-lfs.github.com/spec/"), "macOS DMG begins with an LFS pointer header; regenerate the package")
    require(footer[:4] == b"koly", "macOS DMG has no UDIF koly footer")


def verify_deb() -> None:
    path = DIST / "desktop" / "Teddy-Bud-1.0.0-linux-amd64.deb"
    require(path.is_file(), f"Missing Linux package: {path.relative_to(ROOT)}")
    if not path.is_file():
        return
    members: list[str] = []
    with path.open("rb") as stream:
        magic = stream.read(8)
        if magic != b"!<arch>\n":
            errors.append("Linux DEB has no Debian ar header; regenerate the package")
            return
        while True:
            header = stream.read(60)
            if not header:
                break
            if len(header) != 60 or header[58:60] != b"`\n":
                errors.append("Linux DEB contains an invalid ar member header")
                break
            name = header[:16].decode("ascii", errors="replace").strip().rstrip("/")
            try:
                member_size = int(header[48:58].decode("ascii").strip())
            except ValueError:
                errors.append("Linux DEB contains an invalid ar member size")
                break
            members.append(name)
            stream.seek(member_size + member_size % 2, 1)
    require(bool(members) and members[0] == "debian-binary", "Linux DEB is missing its debian-binary member")
    require(any(name.startswith("control.tar") for name in members), "Linux DEB is missing its control archive")
    require(any(name.startswith("data.tar") for name in members), "Linux DEB is missing its application data archive")


def main() -> int:
    verify_web()
    verify_android()
    verify_apple_zip("ios/TeddyBud-ios.zip", "iPhoneSimulator", "TeddyBud.app/Info.plist")
    verify_apple_zip("macos/TeddyBud-macos.zip", "MacOSX", "TeddyBud.app/Contents/Info.plist")
    verify_windows()
    verify_dmg()
    verify_deb()

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print("All Teddy Bud distribution format checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
