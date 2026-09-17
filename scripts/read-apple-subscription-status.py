#!/usr/bin/env python3
"""Read only Pocket's subscription configuration through Codemagic's integration."""
import json
import re
from urllib.parse import urlsplit

APP_ID = "6806004581"
PRODUCT_ID = "com.nashaimarkets.pocketbullseye.monthly"
BASE = "https://api.appstoreconnect.apple.com"
TERRITORIES = ("GBR", "USA")


def configured_client():
    from codemagic.tools import AppStoreConnect
    # Normal CLI configuration only: no action invocation or credential extraction.
    args = AppStoreConnect._setup_cli_options().parse_args([
        "apps", "get", APP_ID, "--json", "--disable-jwt-cache",
    ])
    return AppStoreConnect.from_cli_args(args).api_client


def inspect_subscription(client):
    calls = 0
    allowed = {f"/v1/apps/{APP_ID}/subscriptionGroups"}

    def get(path, params=None):
        nonlocal calls
        url = path if path.startswith("https://") else BASE + path
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or parsed.netloc != "api.appstoreconnect.apple.com"
                or parsed.path not in allowed or parsed.fragment or calls >= 30):
            raise RuntimeError("Unexpected API URL or request limit reached.")
        calls += 1
        try:
            response = client.session.get(url, params=params, timeout=30, allow_redirects=False)
            if response.status_code != 200:
                raise ValueError("HTTP status")
            return response.json()
        except Exception:
            raise RuntimeError(f"Apple GET failed at {parsed.path}; no changes made.") from None

    def pages(path, params=None):
        payload = get(path, params)
        for _ in range(3):
            yield payload
            next_url = payload.get("links", {}).get("next")
            if not next_url:
                return
            if urlsplit(next_url).path != path:
                raise RuntimeError("Unexpected Apple pagination path.")
            payload = get(next_url)
        raise RuntimeError("Apple pagination limit reached.")

    def rid(item, kind):
        if item.get("type") != kind or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", item.get("id", "")):
            raise RuntimeError("Unexpected Apple configuration resource.")
        return item["id"]

    matches = []
    for page in pages(f"/v1/apps/{APP_ID}/subscriptionGroups", {"limit": 200}):
        if len(page["data"]) > 10:
            raise RuntimeError("Unexpected number of groups; stopped.")
        for group in page["data"]:
            path = f"/v1/subscriptionGroups/{rid(group, 'subscriptionGroups')}/subscriptions"
            allowed.add(path)
            for subscriptions in pages(path, {"filter[productId]": PRODUCT_ID, "limit": 200}):
                matches.extend((group, item) for item in subscriptions["data"] if item.get("attributes", {}).get("productId") == PRODUCT_ID)
    if len(matches) != 1:
        raise RuntimeError("Expected exactly one Pocket monthly subscription; stopped.")
    group, subscription = matches[0]
    sid = rid(subscription, "subscriptions")
    result = {"appId": APP_ID, "groupId": group["id"], "subscriptionId": sid,
              "subscription": {k: subscription["attributes"].get(k) for k in ("name", "productId", "state", "subscriptionPeriod")}, "prices": {}}
    path = f"/v1/subscriptions/{sid}/prices"
    allowed.add(path)
    for territory in TERRITORIES:
        result["prices"][territory] = []
        for page in pages(path, {"filter[territory]": territory, "include": "subscriptionPricePoint,territory", "limit": 200}):
            included = {(i["type"], i["id"]): i.get("attributes", {}) for i in page.get("included", [])}
            for item in page["data"]:
                rel = item["relationships"]
                if item["type"] != "subscriptionPrices" or rel["territory"]["data"]["id"] != territory:
                    raise RuntimeError("Unexpected Apple price resource.")
                point = included.get(("subscriptionPricePoints", rel["subscriptionPricePoint"]["data"]["id"]), {})
                result["prices"][territory].append({"customerPrice": point.get("customerPrice"), "currency": included.get(("territories", territory), {}).get("currency"), **{k: v for k, v in item.get("attributes", {}).items() if k in ("startDate", "endDate", "preserved", "planType")}})
    path = f"/v1/subscriptions/{sid}/subscriptionAvailability"
    allowed.add(path)
    availability = get(path)["data"]
    path = f"/v1/subscriptionAvailabilities/{rid(availability, 'subscriptionAvailabilities')}/availableTerritories"
    allowed.add(path)
    available = {i["id"] for page in pages(path, {"limit": 200}) for i in page["data"] if i.get("type") == "territories"}
    result["availability"] = {t: t in available for t in TERRITORIES}
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(inspect_subscription(configured_client()), indent=2))
    except Exception as error:
        print(json.dumps({"status": "read-failed", "message": str(error) if type(error) is RuntimeError else "Apple configuration could not be read; no changes made."}))
        raise SystemExit(1)
