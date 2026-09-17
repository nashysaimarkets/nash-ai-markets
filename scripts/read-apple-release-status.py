#!/usr/bin/env python3
"""Read Apple release status for the pinned candidate without changing Apple state."""
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pin = json.loads((root / "docs/app-store/release-pin.json").read_text())
version = str(pin["marketingVersion"])
build = str(pin["buildNumber"])
if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", version) or not build.isdigit():
    raise SystemExit("Release pin must contain a valid version and build number.")

app_id = "6806004581"
commands = [
    ["apps", "app-store-versions", app_id, "--platform", "IOS", "--json"],
    ["get-latest-build-number", app_id, "--include-version"],
    ["builds", "list", "--app-id", app_id, "--platform", "IOS",
     "--pre-release-version", version, "--build-version-number", build, "--json"],
]
print(f"Reading Apple status for candidate {version} ({build})", flush=True)
for command in commands:
    subprocess.run(["app-store-connect", *command], check=True, timeout=180)
