"""Verify the already uploaded package before submitting its Apple build."""

import json
import plistlib
import sys
import zipfile
from pathlib import Path

pin = json.loads(Path("docs/app-store/release-pin.json").read_text())
with zipfile.ZipFile(sys.argv[1]) as ipa:
    infos = [name for name in ipa.namelist() if name.count("/") == 2 and name.startswith("Payload/") and name.endswith(".app/Info.plist")]
    if len(infos) != 1:
        raise SystemExit("Expected exactly one application in the signed IPA.")
    info = plistlib.loads(ipa.read(infos[0]))
    expected = {
        "CFBundleIdentifier": "com.nashaimarkets.pocketbullseye",
        "CFBundleShortVersionString": "1.2.7",
        "CFBundleVersion": "23",
    }
    for key, value in expected.items():
        if str(info.get(key)) != value:
            raise SystemExit(f"Signed package {key} does not match the approved release.")
    config_path = infos[0].removesuffix("Info.plist") + "capacitor.config.json"
    config = json.loads(ipa.read(config_path))
    approved_url = "https://nash-ai-markets-h7pu79ul9-nash-ai-markets.vercel.app/pocket"
    if config.get("server", {}).get("url", "").rstrip("/") != approved_url:
        raise SystemExit("Signed package does not point to the user-tested deployment.")
    if pin["serverUrl"] != approved_url or pin["revision"] != "dbd52fbb1d66163c2455cc2d11a674ce37d5de64":
        raise SystemExit("Repository release pin differs from the approved release.")
print("Verified signed Pocket Bullseye 1.2.7 build 23 and approved deployment.")
