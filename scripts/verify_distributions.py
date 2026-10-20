#!/usr/bin/env python3
"""Validate Teddy Bud V 1.0 distribution package structure."""
from __future__ import annotations
import gzip, json, struct, sys, zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/"dist"
errors=[]
def require(ok, message):
    if not ok: errors.append(message)
class AssetParser(HTMLParser):
    def __init__(self): super().__init__(); self.paths=[]
    def handle_starttag(self, tag, attrs):
        self.paths.extend(v for k,v in attrs if k in {"src","href"} and v)
def verify_web():
    index=DIST/"web"/"index.html"
    require(index.is_file(),"Missing dist/web/index.html")
    if not index.is_file(): return
    parser=AssetParser(); parser.feed(index.read_text(encoding="utf-8"))
    for raw in parser.paths:
        u=urlparse(raw)
        if u.scheme or u.netloc or raw.startswith("#"): continue
        asset=(index.parent/(u.path.lstrip("/") if u.path.startswith("/") else u.path)).resolve()
        require(asset.is_relative_to(index.parent.resolve()) and asset.is_file(),f"Missing web asset: {raw}")
    manifest=index.parent/"manifest.webmanifest"
    try: data=json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError,json.JSONDecodeError) as exc: errors.append(f"Cannot read web manifest: {exc}"); return
    for icon in data.get("icons",[]):
        src=icon.get("src") if isinstance(icon,dict) else None
        if not src: errors.append("Manifest icon missing src"); continue
        u=urlparse(src)
        if u.scheme or u.netloc: continue
        asset=(manifest.parent/(u.path.lstrip("/") if u.path.startswith("/") else u.path)).resolve()
        require(asset.is_relative_to(manifest.parent.resolve()) and asset.is_file(),f"Missing manifest icon: {src}")
def verify_apk():
    p=DIST/"android"/"Teddybird-V-1.0-Android-arm64.apk"
    require(p.is_file(),f"Missing APK: {p.relative_to(ROOT)}")
    if not p.is_file(): return
    require(zipfile.is_zipfile(p),"Android APK is not a valid ZIP container")
    try:
        with zipfile.ZipFile(p) as z:
            names=z.namelist()
            require(z.testzip() is None,"APK archive CRC check failed")
            require("AndroidManifest.xml" in names,"APK missing AndroidManifest.xml")
            require(any(n.startswith("classes") and n.endswith(".dex") for n in names),"APK missing DEX bytecode")
            require(any(n.startswith("lib/arm64-v8a/") for n in names),"APK missing ARM64 native libraries")
    except (OSError,zipfile.BadZipFile) as exc: errors.append(f"Cannot inspect APK: {exc}")
def verify_windows():
    p=DIST/"desktop"/"Teddybird-V-1.0-win-x64.exe"
    b=DIST/"desktop"/"Teddybird-V-1.0-win-x64.exe.blockmap"
    for f in (p,b): require(f.is_file(),f"Missing Windows file: {f.name}")
    if p.is_file():
        with p.open("rb") as f:
            h=f.read(64); valid=h[:2]==b"MZ" and len(h)>=64
            if valid: f.seek(struct.unpack("<I",h[60:64])[0]); valid=f.read(4)==b"PE\\0\\0"
            require(valid,"Windows installer has invalid PE signature")
    if b.is_file():
        try:
            data=b.read_bytes(); require(data[:2]==b"\\x1f\\x8b","Blockmap is not gzip")
            gzip.decompress(data)
        except (OSError,EOFError): errors.append("Windows blockmap gzip stream invalid")
def verify_dmg(name, required):
    p=DIST/"desktop"/name
    if not required and not p.exists(): return
    require(p.is_file(),f"Missing macOS DMG: {name}")
    if not p.is_file(): return
    with p.open("rb") as f:
        size=p.stat().st_size; prefix=f.read(64); footer=b""
        if size>=512: f.seek(-512,2); footer=f.read(512)
    require(not prefix.startswith(b"version https://git-lfs.github.com/spec/"),f"{name} is an LFS pointer, not a DMG")
    require(footer[:4]==b"koly",f"{name} has no UDIF footer")
def verify_deb():
    p=DIST/"desktop"/"Teddybird-V-1.0-linux-x64.deb"
    require(p.is_file(),f"Missing Linux DEB: {p.name}")
    if not p.is_file(): return
    members=[]
    with p.open("rb") as f:
        if f.read(8)!=b"!<arch>\\n": errors.append("DEB has invalid ar header"); return
        while True:
            h=f.read(60)
            if not h: break
            if len(h)!=60 or h[58:60]!=b"\\x60\\n": errors.append("Invalid DEB ar member header"); break
            name=h[:16].decode("ascii",errors="replace").strip().rstrip("/")
            try: size=int(h[48:58].decode("ascii").strip())
            except ValueError: errors.append("Invalid DEB member size"); break
            members.append(name); f.seek(size+size%2,1)
    require(bool(members) and members[0]=="debian-binary","DEB missing debian-binary")
    require(any(n.startswith("control.tar") for n in members),"DEB missing control archive")
    require(any(n.startswith("data.tar") for n in members),"DEB missing data archive")
def main():
    verify_web(); verify_apk(); verify_windows()
    verify_dmg("Teddybird-V-1.0-mac-arm64.dmg",True)
    verify_dmg("Teddybird-V-1.0-mac-x64.dmg",False); verify_deb()
    require(not (DIST/"ios").exists(),"Unexpected iOS distribution folder")
    require(not (DIST/"macos").exists(),"Unexpected duplicate macOS ZIP folder")
    if errors:
        for e in errors: print("FAIL:",e)
        return 1
    print("All Teddybird V 1.0 distribution checks passed.")
    return 0
if __name__=="__main__": sys.exit(main())
