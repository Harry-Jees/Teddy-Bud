#!/usr/bin/env python3
"""Assemble only freshly built files from isolated GitHub Actions artifacts."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


def find_file(artifact: Path, filename: str) -> Path | None:
    matches = sorted(path for path in artifact.rglob(filename) if path.is_file())
    return matches[0] if matches else None


def copy_required(artifacts: Path, artifact_name: str, filename: str, target: Path) -> None:
    artifact = artifacts / artifact_name
    source = find_file(artifact, filename) if artifact.is_dir() else None
    if source is None:
        raise FileNotFoundError(f"{filename} is missing from artifact {artifact_name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    print(f"Collected {artifact_name}/{filename} -> {target}")


def copy_optional(artifacts: Path, artifact_name: str, filename: str, target: Path) -> None:
    artifact = artifacts / artifact_name
    source = find_file(artifact, filename) if artifact.is_dir() else None
    if source is not None:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        print(f"Collected optional {artifact_name}/{filename} -> {target}")


def collect_web(artifacts: Path, destination: Path) -> None:
    artifact = artifacts / "teddy-bud-web"
    if not artifact.is_dir():
        raise FileNotFoundError("Web build artifact teddy-bud-web is missing")

    candidates = sorted(artifact.rglob("index.html"))
    index = next(
        (
            candidate
            for candidate in candidates
            if (candidate.parent / "manifest.webmanifest").is_file()
            and (candidate.parent / "assets").is_dir()
        ),
        None,
    )
    if index is None:
        raise FileNotFoundError("Web artifact has no index.html, manifest, and assets directory")

    destination.mkdir(parents=True, exist_ok=True)
    shutil.copytree(index.parent, destination, dirs_exist_ok=True)
    print(f"Collected web app from {index.parent} -> {destination}")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: collect_distributions.py ARTIFACTS_DIR DIST_DIR", file=sys.stderr)
        return 2

    artifacts = Path(sys.argv[1]).resolve()
    dist = Path(sys.argv[2]).resolve()
    if not artifacts.is_dir():
        print(f"Artifact directory does not exist: {artifacts}", file=sys.stderr)
        return 2

    try:
        collect_web(artifacts, dist / "web")
        copy_required(
            artifacts,
            "teddy-bud-android-debug",
            "TeddyBud-android-debug.apk",
            dist / "android" / "TeddyBud-android-debug.apk",
        )
        copy_required(
            artifacts,
            "teddy-bud-ios",
            "TeddyBud-ios.zip",
            dist / "ios" / "TeddyBud-ios.zip",
        )
        copy_required(
            artifacts,
            "teddy-bud-macos",
            "TeddyBud-macos.zip",
            dist / "macos" / "TeddyBud-macos.zip",
        )

        windows_files = (
            "Teddy-Bud-1.0.0-win-x64.exe",
            "Teddy-Bud-1.0.0-win-x64.exe.blockmap",
        )
        for filename in windows_files:
            copy_required(
                artifacts,
                "teddy-bud-windows",
                filename,
                dist / "desktop" / filename,
            )

        copy_required(
            artifacts,
            "teddy-bud-macos-desktop",
            "Teddy-Bud-1.0.0-mac-arm64.dmg",
            dist / "desktop" / "Teddy-Bud-1.0.0-mac-arm64.dmg",
        )
        copy_optional(
            artifacts,
            "teddy-bud-macos-desktop",
            "Teddy-Bud-1.0.0-mac-x64.dmg",
            dist / "desktop" / "Teddy-Bud-1.0.0-mac-x64.dmg",
        )
        copy_required(
            artifacts,
            "teddy-bud-linux-deb",
            "Teddy-Bud-1.0.0-linux-amd64.deb",
            dist / "desktop" / "Teddy-Bud-1.0.0-linux-amd64.deb",
        )
    except FileNotFoundError as error:
        print(f"Collection failed: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
