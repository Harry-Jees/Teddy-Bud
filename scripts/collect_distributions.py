#!/usr/bin/env python3
"""Collect supported Teddy Bud V 1.0 distributions from isolated CI artifacts."""
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
    # Artifact extraction may not preserve Unix mode bits.
    if target.name.endswith(".AppImage"):
        target.chmod(target.stat().st_mode | 0o111)
    print(f"Collected {source} -> {target}")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: collect_distributions.py ARTIFACTS_DIR DIST_DIR", file=sys.stderr)
        return 2
    artifacts, dist = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    if not artifacts.is_dir():
        print(f"Artifact directory does not exist: {artifacts}", file=sys.stderr)
        return 2

    # Replace the managed package folders, not merely overwrite matching names.
    # This prevents stale versions and obsolete filenames from surviving a build.
    for managed in ("android", "desktop", "ios", "web", "macos"):
        path = dist / managed
        if path.exists():
            shutil.rmtree(path)
    (dist / "android").mkdir(parents=True, exist_ok=True)
    (dist / "desktop").mkdir(parents=True, exist_ok=True)

    try:
        copy_file(artifacts, "teddy-bud-android", "TeddyBud.v.1.0-Android-arm64.apk", dist / "android" / "TeddyBud.v.1.0-Android-arm64.apk")
        for name in ("TeddyBud.v.1.0-win-x64.exe", "TeddyBud.v.1.0-win-x64.exe.blockmap"):
            copy_file(artifacts, "teddy-bud-windows", name, dist / "desktop" / name)
        copy_file(artifacts, "teddy-bud-macos-arm64", "TeddyBud.v.1.0-mac-arm64.dmg", dist / "desktop" / "TeddyBud.v.1.0-mac-arm64.dmg")
        copy_file(artifacts, "teddy-bud-linux", "TeddyBud.v.1.0-linux-amd64.deb", dist / "desktop" / "TeddyBud.v.1.0-linux-amd64.deb")
        copy_file(artifacts, "teddy-bud-linux", "TeddyBud.v.1.0-linux-amd64.AppImage", dist / "desktop" / "TeddyBud.v.1.0-linux-amd64.AppImage")
    except FileNotFoundError as exc:
        print(f"Collection failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
