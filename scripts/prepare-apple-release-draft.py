#!/usr/bin/env python3
"""Prepare the existing Apple draft only. Never submit, cancel, or create a version."""
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("guard", ROOT / "scripts/submit-staged-iphone.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


def main():
    candidate = json.loads((ROOT / "docs/app-store/staged-release.json").read_text())
    pin = json.loads((ROOT / "docs/app-store/release-pin.json").read_text())
    for key in ("marketingVersion", "buildNumber", "revision"):
        if candidate[key] != pin[key]:
            raise RuntimeError("Candidate differs from verified release pin")
    notes = json.loads((ROOT / "release_notes.json").read_text())
    if len(notes) != 1 or notes[0].get("language") != "en-GB" or not 1 <= len(notes[0].get("text", "")) <= 4000:
        raise RuntimeError("Expected verified en-GB release notes")
    app_id = candidate["appId"]

    def draft():
        versions = guard.read_apple("apps", "app-store-versions", app_id, "--platform", "IOS")
        submissions = guard.read_apple("apps", "list-review-submissions", app_id, "--platform", "IOS")
        decision, reason = guard.gate(versions, submissions, candidate)
        if decision != "ready":
            raise RuntimeError("Preserving Apple state: " + reason)
        targets = [v for v in versions if v["attributes"]["versionString"] == candidate["marketingVersion"]]
        if len(targets) != 1 or guard.state(targets[0]) != "PREPARE_FOR_SUBMISSION":
            raise RuntimeError("Expected exactly one editable existing draft")
        return targets[0]

    build_id = guard.verify_build(guard.read_apple(
        "builds", "list", "--app-id", app_id, "--platform", "IOS",
        "--pre-release-version", candidate["marketingVersion"],
        "--build-version-number", candidate["buildNumber"],
    ), candidate)
    target = draft()
    locales = guard.read_apple("app-store-versions", "localizations", target["id"])
    english = [v for v in locales if v["type"] == "appStoreVersionLocalizations" and v["attributes"].get("locale") == "en-GB"]
    if len(english) != 1:
        raise RuntimeError("Expected existing en-GB localization; no creation permitted")
    locale_id = english[0]["id"]
    if draft()["id"] != target["id"]:
        raise RuntimeError("Draft identity changed")
    subprocess.run(["app-store-connect", "app-store-versions", "modify", target["id"],
                    "--build-id", build_id, "--release-type", "AFTER_APPROVAL"], check=True, timeout=180)
    if draft()["id"] != target["id"]:
        raise RuntimeError("Draft identity changed")
    subprocess.run(["app-store-connect", "app-store-version-localizations", "modify", locale_id,
                    "--whats-new", notes[0]["text"]], check=True, timeout=180)
    linked = guard.read_apple("builds", "app-store-version", build_id)
    localized = guard.read_apple("app-store-version-localizations", "get", locale_id)
    if (linked["id"] != target["id"] or guard.state(linked) != "PREPARE_FOR_SUBMISSION"
            or linked["attributes"].get("releaseType") != "AFTER_APPROVAL"
            or localized["attributes"].get("whatsNew") != notes[0]["text"]):
        raise RuntimeError("Draft verification incomplete; inspect before retrying")
    print(f"DRAFT VERIFIED: {candidate['marketingVersion']} ({candidate['buildNumber']}); en-GB notes saved; AFTER_APPROVAL")
    print("NOT SUBMITTED: physical iPhone customer-journey validation remains required")


if __name__ == "__main__":
    main()
