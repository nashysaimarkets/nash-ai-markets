#!/usr/bin/env python3
"""Read Apple release status for the pinned candidate without changing Apple state."""
import importlib.util
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_guard", root / "scripts/submit-staged-iphone.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
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
    result = subprocess.run(["app-store-connect", *command], check=True, timeout=180,
                            text=True, capture_output=True)
    print(result.stdout, end="", flush=True)

# The final command lists the exact pinned build. Read TestFlight readiness
# separately; a VALID upload alone does not establish tester availability.
for build in guard.parse_cli_json(result.stdout):
    if build.get("type") != "builds":
        raise RuntimeError("Unexpected resource returned for the pinned build.")
    subprocess.run(["app-store-connect", "builds", "beta-details", build["id"], "--json"],
                   check=True, timeout=180)
