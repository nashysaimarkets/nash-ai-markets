#!/usr/bin/env python3
"""Read only Pocket's subscription configuration through Codemagic's integration."""
import json
import os
import re
import shlex
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

APP_ID = "6806004581"
PRODUCT_ID = "com.nashaimarkets.pocketbullseye.monthly"
BASE = "https://api.appstoreconnect.apple.com"
TERRITORIES = ("GBR", "USA")
STAGE = "sdk-import"
HTTP_STATUS = None


def configured_client():
    global STAGE
    try:
        from codemagic.tools import AppStoreConnect
    except ImportError:
        if "--cli-python" in sys.argv:
            raise
        STAGE = "cli-interpreter-resolution"
        entrypoint = shutil.which("app-store-connect")
        if not entrypoint:
            raise RuntimeError("Codemagic CLI is unavailable.")
        with Path(entrypoint).open() as source:
            shebang = source.readline().strip()
        interpreter = shlex.split(shebang[2:]) if shebang.startswith("#!") else []
        if len(interpreter) == 2 and interpreter[0] == "/usr/bin/env":
            interpreter = [shutil.which(interpreter[1]) or ""]
        if (len(interpreter) != 1 or not Path(interpreter[0]).is_absolute()
                or not re.fullmatch(r"python[0-9]*(?:\.[0-9]+)*", Path(interpreter[0]).name)):
            raise RuntimeError("Codemagic CLI Python interpreter could not be resolved.")
        sys.stdout.flush()
        os.execv(interpreter[0], [interpreter[0], str(Path(__file__).resolve()), "--cli-python"])
    # Normal CLI configuration only: no action invocation or credential extraction.
    STAGE = "cli-options"
    args = AppStoreConnect._setup_cli_options().parse_args([
        "apps", "get", APP_ID, "--json", "--disable-jwt-cache",
    ])
    STAGE = "integration-configuration"
    configured = AppStoreConnect.from_cli_args(args)
    STAGE = "api-client"
    return configured.api_client


def main():
    client = configured_client()
    copy = {"promotionalText":"Check chart levels, patterns and risk. Add optional options-volume or crypto derivatives screenshots for context. One complete analysis free; subscription thereafter.","keywords":"chart,analysis,trading,patterns,support,resistance,crypto,options,risk,education","description":"Pocket Bullseye helps you take a second look at your trading chart before making your own decision.\n\nUpload a clear chart screenshot, with up to four optional supporting views of the same instrument. Review visible support and resistance, market structure, bullish and bearish scenarios, invalidation and reasons to wait.\n\nEXPLORE THE EVIDENCE\n• Interactive chart levels and a compact chart/timeframe selector.\n• Pattern X-Ray and Liquidity Guard to inspect visible structure and potential traps.\n• Conditional scenarios, risk context and missing confirmation.\n• Saved chart reviews and comparison tools.\n\nOPTIONAL MARKET CONTEXT\nAdd a labelled options-volume screenshot to cross-check visible strike concentrations against chart levels. For crypto, add a derivatives panel to review visible crowding, liquidation pressure and conflicts with price structure. These checks are separate from the chart verdict and depend on readable uploaded evidence.\n\nONE COMPLETE ANALYSIS FREE\nDownload on iPhone or iPad and try one complete analysis free. Further analysis requires a monthly subscription (£4.99 in the UK; regional prices vary). Payment is charged to your Apple Account. Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel it in Apple Account settings. Use Restore Purchases with the Apple Account that made the purchase.\n\nPocket Bullseye provides educational screenshot analysis. It does not connect to a broker, execute trades or provide a live market-data feed. AI can misread charts. Verify prices and findings independently. Output is not personalised financial advice and does not guarantee results.\n\nSupport: hello@nashaimarkets.com\nPrivacy: https://pocket.nashaimarkets.com/privacy\nTerms: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"}
    def get(path):
        if not re.fullmatch(r"/v1/[A-Za-z0-9_/-]+", path):
            raise RuntimeError("Unexpected resource path")
        r = client.session.get(BASE + path, timeout=30, allow_redirects=False)
        if r.status_code != 200:
            raise RuntimeError(f"Apple GET failed: {r.status_code}")
        data = r.json()
        if data.get("links", {}).get("next"):
            raise RuntimeError("Additional results require explicit inspection")
        return data["data"]
    versions = get(f"/v1/apps/{APP_ID}/appStoreVersions")
    target = [v for v in versions if v["attributes"].get("versionString") == "1.2.14" and v["attributes"].get("platform") == "IOS"]
    if len(target) != 1:
        raise RuntimeError("Expected exact existing iOS 1.2.14; no version creation")
    version = target[0]
    attrs = version["attributes"]
    state = attrs.get("appVersionState") or attrs.get("appStoreState")
    print("VERSION", json.dumps({"id":version["id"],"version":"1.2.14","state":state,"releaseType":attrs.get("releaseType")}), flush=True)
    locales = get(f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations")
    print("LOCALES", json.dumps([l["attributes"].get("locale") for l in locales]), flush=True)
    english = [l for l in locales if l["attributes"].get("locale") == "en-GB"]
    if len(english) != 1:
        raise RuntimeError("Expected existing en-GB locale")
    loc = english[0]
    before = loc["attributes"]
    print("BEFORE", json.dumps(before), flush=True)
    sets = get(f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")
    for screenshot_set in sets:
        shots = get(f"/v1/appScreenshotSets/{screenshot_set['id']}/appScreenshots")
        print("SCREENSHOTS", json.dumps({"displayType":screenshot_set["attributes"].get("screenshotDisplayType"),"images":[{"id":s["id"],**{k:s["attributes"].get(k) for k in ["fileName","sourceFileChecksum","imageAsset","assetDeliveryState"]}} for s in shots]}), flush=True)
    # Promotional text is editable without a new version. Never alter review state.
    updates = {"promotionalText":copy["promotionalText"]}
    editable = {"PREPARE_FOR_SUBMISSION", "INVALID_BINARY", "REJECTED", "METADATA_REJECTED", "DEVELOPER_REJECTED"}
    current = get(f"/v1/appStoreVersions/{version['id']}")
    current_state = current["attributes"].get("appVersionState") or current["attributes"].get("appStoreState")
    if current_state in editable:
        updates.update({k:copy[k] for k in ("description", "keywords")})
    updates = {k:v for k,v in updates.items() if before.get(k) != v}
    if updates:
        r = client.session.patch(BASE + f"/v1/appStoreVersionLocalizations/{loc['id']}", json={"data":{"type":"appStoreVersionLocalizations","id":loc["id"],"attributes":updates}}, timeout=30, allow_redirects=False)
        if r.status_code != 200:
            print("UPDATE_FAILED", json.dumps({"status":r.status_code,"errors":[{k:e.get(k) for k in ['code','title','detail']} for e in r.json().get('errors',[])]}), flush=True)
            raise RuntimeError("Apple did not accept metadata update; no retry")
    after = get(f"/v1/appStoreVersionLocalizations/{loc['id']}")["attributes"]
    if any(after.get(k) != v for k,v in updates.items()):
        raise RuntimeError("Metadata verification mismatch")
    print("VERIFIED", json.dumps({"updatedFields":list(updates),"promotionalText":after.get("promotionalText"),"state":current_state,"screenshotsEditable":current_state in editable,"newBuild":False,"reviewWithdrawn":False}), flush=True)

if __name__ == "__main__":
    main()
