#!/usr/bin/env python3
"""Collect only supported Teddy Bud V 1.0 distributions from CI artifacts."""
from __future__ import annotations
import shutil
import sys
from pathlib import Path

def find_file(root: Path, filename: str) -> Path | None:
    matches = sorted(p for p in root.rglob(filename) if p.is_file()) if root.is_dir() else []
    return matches[0] if matches else None

def copy_file(artifacts: Path, artifact_name: str, filename: str, target: Path, required: bool = True) -> None:
    source = find_file(artifacts / artifact_name, filename)
    if source is None:
        if required:
            raise FileNotFoundError(f"{filename} missing from artifact {artifact_name}")
        print(f"Optional package not present: {artifact_name}/{filename}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    print(f"Collected {source} -> {target}")

def collect_web(artifacts: Path, target: Path) -> None:
    root = artifacts / "teddy-bud-web"
    index = next((p for p in sorted(root.rglob("index.html"))
                  if (p.parent / "manifest.webmanifest").is_file()
                  and (p.parent / "assets").is_dir()), None)
    if index is None:
        raise FileNotFoundError("Web artifact has no index, manifest, and assets directory")
    shutil.copytree(index.parent, target, dirs_exist_ok=True)

def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: collect_distributions.py ARTIFACTS_DIR DIST_DIR", file=sys.stderr)
        return 2
    artifacts, dist = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    if not artifacts.is_dir():
        print(f"Artifact directory does not exist: {artifacts}", file=sys.stderr)
        return 2
    try:
        collect_web(artifacts, dist / "web")
        copy_file(artifacts, "teddy-bud-android", "Teddybird-V-1.0-Android-arm64.apk", dist / "android" / "Teddybird-V-1.0-Android-arm64.apk")
        for name in ("Teddybird-V-1.0-win-x64.exe", "Teddybird-V-1.0-win-x64.exe.blockmap"):
            copy_file(artifacts, "teddy-bud-windows", name, dist / "desktop" / name)
        copy_file(artifacts, "teddy-bud-macos-dmg", "Teddybird-V-1.0-mac-arm64.dmg", dist / "desktop" / "Teddybird-V-1.0-mac-arm64.dmg")
        copy_file(artifacts, "teddy-bud-macos-dmg", "Teddybird-V-1.0-mac-x64.dmg", dist / "desktop" / "Teddybird-V-1.0-mac-x64.dmg", required=False)
        copy_file(artifacts, "teddy-bud-linux-deb", "Teddybird-V-1.0-linux-x64.deb", dist / "desktop" / "Teddybird-V-1.0-linux-x64.deb")
    except FileNotFoundError as exc:
        print(f"Collection failed: {exc}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
