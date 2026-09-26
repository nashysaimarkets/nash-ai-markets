import assert from "node:assert/strict";
import test from "node:test";
import { campaignAttribution } from "../app/lib/marketing-attribution.ts";
import { isPocketFunnelEvent } from "../app/lib/marketing-funnel.ts";

test("campaign attribution normalizes known labels and safe campaign tokens", () => {
  assert.deepEqual(campaignAttribution({
    utm_source: "TikTok",
    utm_medium: "Social_Ads",
    utm_campaign: "Founding650",
  }), {
    source: "tiktok",
    medium: "social_ads",
    campaign: "founding650",
  });
});

test("unknown sources are grouped as other and unsafe labels use safe defaults", () => {
  assert.deepEqual(campaignAttribution({
    utm_source: "some-new-referrer",
    utm_medium: "paid search",
    utm_campaign: "Founding 650",
  }), {
    source: "other",
    medium: "referral",
    campaign: "founding650",
  });
  assert.equal(campaignAttribution({ utm_source: "google" }).source, "google");
  assert.equal(campaignAttribution({ utm_source: "Google Search" }).source, "direct");
});

test("only the Pocket founding funnel event vocabulary is accepted", () => {
  assert.equal(isPocketFunnelEvent("checkout_started"), true);
  assert.equal(isPocketFunnelEvent("checkout_cancelled"), true);
  assert.equal(isPocketFunnelEvent("purchase_completed"), false);
  assert.equal(isPocketFunnelEvent("arbitrary-event"), false);
});
