#!/usr/bin/env python3
"""Submit an already uploaded candidate only after the preceding release is live.

Uses Codemagic's existing App Store integration. No credentials are read or logged
by this script. Without --submit this is a read-only status check.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASED = {"READY_FOR_DISTRIBUTION", "REPLACED_WITH_NEW_VERSION"}
PROTECTED = {
    "WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_APPLE_RELEASE",
    "PENDING_DEVELOPER_RELEASE", "PROCESSING_FOR_DISTRIBUTION",
    "WAITING_FOR_EXPORT_COMPLIANCE", "PENDING_CONTRACT", "ACCEPTED",
}
ALIASES = {
    "READY_FOR_SALE": "READY_FOR_DISTRIBUTION",
    "PROCESSING_FOR_APP_STORE": "PROCESSING_FOR_DISTRIBUTION",
}


def parse_cli_json(output):
    """Codemagic emits progress lines before its --json resource output."""
    clean = re.sub(r"\x1b\[[0-9;]*m", "", output)
    decoder = json.JSONDecoder()
    for match in re.finditer(r"(?m)^\s*[\[{]", clean):
        try:
            value, _ = decoder.raw_decode(clean[match.start():].lstrip())
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and "type" in value and "id" in value:
            return value
        if isinstance(value, list) and all(
            isinstance(item, dict) and "type" in item and "id" in item for item in value
        ):
            return value
    raise RuntimeError("Apple status did not contain valid resource JSON; no submission made.")


def read_apple(*args):
    result = subprocess.run(
        ["app-store-connect", *args, "--json"],
        text=True, capture_output=True, timeout=180,
    )
    if result.returncode:
        raise RuntimeError(f"Apple read failed ({' '.join(args[:2])}); no submission made.")
    return parse_cli_json(result.stdout)


def state(version):
    attrs = version["attributes"]
    value = attrs.get("appVersionState") or attrs.get("appStoreState")
    if not value:
        raise RuntimeError("Apple version state is missing; no submission made.")
    return ALIASES.get(value, value)


def gate(versions, submissions, candidate):
    """Return a decision without changing Apple state; unknown states fail closed."""
    by_version = {}
    for version in versions:
        attrs = version["attributes"]
        if version["type"] != "appStoreVersions" or attrs.get("platform") != "IOS":
            raise RuntimeError("Unexpected Apple version resource.")
        name = attrs["versionString"]
        if name in by_version:
            raise RuntimeError("Duplicate Apple version resource.")
        by_version[name] = version
    target = by_version.get(candidate["marketingVersion"])
    if target and state(target) in RELEASED | PROTECTED:
        return "already-submitted", f"{candidate['marketingVersion']} is {state(target)}"
    if target and state(target) != "PREPARE_FOR_SUBMISSION":
        raise RuntimeError(f"Candidate needs attention: {state(target)}; no resubmission made.")
    previous = by_version.get(candidate["predecessorVersion"])
    if not previous:
        raise RuntimeError("The preceding Apple version was not found.")
    if state(previous) in PROTECTED:
        return "deferred", f"Preserving {candidate['predecessorVersion']}: {state(previous)}"
    if state(previous) not in RELEASED:
        raise RuntimeError(f"Preceding release needs attention: {state(previous)}")
    for name, version in by_version.items():
        if version is target:
            continue
        current = state(version)
        if current in PROTECTED:
            return "deferred", f"Preserving {name}: {current}"
        if current not in RELEASED:
            raise RuntimeError(f"Another version needs attention: {name} {current}")
        if tuple(map(int, name.split('.'))) > tuple(map(int, candidate['marketingVersion'].split('.'))):
            raise RuntimeError("A newer release exists; this candidate will not be submitted.")
    for submission in submissions:
        if submission["type"] != "reviewSubmissions":
            raise RuntimeError("Unexpected review submission resource.")
        current = submission["attributes"]["state"]
        if current in {"WAITING_FOR_REVIEW", "IN_REVIEW", "COMPLETING", "CANCELING"}:
            return "deferred", f"Preserving existing review submission: {current}"
        if current != "COMPLETE":
            raise RuntimeError(f"Existing review submission needs attention: {current}")
    return "ready", "Previous release is complete and no review is active."


def verify_build(builds, candidate):
    if len(builds) != 1:
        raise RuntimeError("Expected exactly one uploaded candidate build.")
    build = builds[0]
    attrs = build["attributes"]
    if (build["type"] != "builds" or build["id"] != candidate["appleBuildId"]
            or attrs.get("version") != candidate["buildNumber"]):
        raise RuntimeError("Apple build identity does not match the verified candidate.")
    if attrs.get("processingState") != "VALID" or attrs.get("expired") is not False:
        raise RuntimeError("Candidate is not a valid, unexpired Apple build.")
    return build["id"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--submit", action="store_true")
    args = parser.parse_args()
    candidate = json.loads((ROOT / "docs/app-store/staged-release.json").read_text())
    pin = json.loads((ROOT / "docs/app-store/release-pin.json").read_text())
    for key in ("marketingVersion", "buildNumber", "revision"):
        if candidate[key] != pin[key]:
            raise RuntimeError(f"Staged candidate differs from release pin: {key}")
    app_id = candidate["appId"]

    def decision():
        versions = read_apple("apps", "app-store-versions", app_id, "--platform", "IOS")
        submissions = read_apple("apps", "list-review-submissions", app_id, "--platform", "IOS")
        return gate(versions, submissions, candidate)

    build_id = verify_build(read_apple(
        "builds", "list", "--app-id", app_id, "--platform", "IOS",
        "--pre-release-version", candidate["marketingVersion"],
        "--build-version-number", candidate["buildNumber"],
    ), candidate)
    status, reason = decision()
    print(f"CANDIDATE: {candidate['marketingVersion']} ({candidate['buildNumber']}) {build_id} VALID")
    print(f"STATUS: {status.upper()} — {reason}")
    if status == "already-submitted":
        linked = read_apple("builds", "app-store-version", build_id)
        if linked["attributes"]["versionString"] != candidate["marketingVersion"]:
            raise RuntimeError("Existing submission uses a different build; manual investigation required.")
        return
    if not args.submit or status != "ready":
        return
    # Refresh immediately before the only mutation. Never cancel a submission.
    status, reason = decision()
    if status != "ready":
        print(f"STATUS: {status.upper()} — {reason}")
        return
    notes = json.loads((ROOT / "release_notes.json").read_text())
    if len(notes) != 1 or notes[0].get("language") != "en-GB" or not 1 <= len(notes[0].get("text", "")) <= 4000:
        raise RuntimeError("Expected the verified English release notes.")
    subprocess.run([
        "app-store-connect", "builds", "submit-to-app-store", build_id,
        "--platform", "IOS", "--version-string", candidate["marketingVersion"],
        "--release-type", "AFTER_APPROVAL",
        "--locale", notes[0]["language"], "--whats-new", notes[0]["text"],
    ], check=True, timeout=300)
    linked = read_apple("builds", "app-store-version", build_id)
    if linked["attributes"]["versionString"] != candidate["marketingVersion"] or state(linked) not in PROTECTED | RELEASED:
        raise RuntimeError("Submission was attempted but Apple confirmation is incomplete; investigate before retrying.")
    print(f"STATUS: SUBMITTED — {candidate['marketingVersion']} ({candidate['buildNumber']}) {state(linked)}")


if __name__ == "__main__":
    main()
