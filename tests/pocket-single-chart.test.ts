import test from "node:test";
import assert from "node:assert/strict";
import { POCKET_IMAGE_SLOTS, normalizePatternFrame, pocketImageContent, scopePocketImageEvidence, validatePocketImages } from "../app/pocket/chart-images.ts";

const chart = "data:image/png;base64,aGVsbG8=";

test("every combination of optional charts accepts a primary image and sends only supplied images", () => {
  for (let mask = 0; mask < 16; mask++) {
    const images: Record<string, string | null> = { image: chart };
    POCKET_IMAGE_SLOTS.slice(1).forEach(([field], index) => { images[field] = mask & (1 << index) ? chart : null; });
    assert.equal(validatePocketImages(images), null);
    const content = pocketImageContent(images);
    const uploaded = Object.values(images).filter(Boolean).length;
    assert.equal(content.filter((item) => item.type === "input_image").length, uploaded);
    assert.equal(content.filter((item) => item.type === "input_text").length, uploaded);
    for (const item of content) if (item.type === "input_image") assert.equal(item.image_url, chart);
  }
});

test("missing primary and malformed or oversized optional images fail validation", () => {
  assert.ok(validatePocketImages({}));
  assert.ok(validatePocketImages({ contextImage: chart }));
  for (const [field] of POCKET_IMAGE_SLOTS) {
    for (const invalid of [42, {}, "https://example.com/chart.png", "data:image/svg+xml;base64,abc"]) {
      assert.ok(validatePocketImages({ image: chart, [field]: invalid }));
    }
    assert.ok(validatePocketImages({ image: chart, [field]: chart + "extra" }, chart.length));
  }
});

test("a single chart cannot acquire invented higher-timeframe confirmation or patterns from absent images", () => {
  const result = scopePocketImageEvidence({
    higherTimeframe: { provided: true, timeframe: "4H", alignment: "ALIGNED" },
    contextContribution: { used: true },
    patterns: [{ sourceRole: "PRIMARY", name: "BULL FLAG" }, { sourceRole: "FOUR_HOUR", name: "BEAR FLAG" }],
  }, { image: chart });
  assert.deepEqual(result.patterns, [{ sourceRole: "PRIMARY", name: "BULL FLAG" }]);
  assert.equal((result.higherTimeframe as { provided: boolean }).provided, false);
  assert.equal((result.contextContribution as { used: boolean }).used, false);
});

test("an optional fourth chart retains its exact source role even with the middle slots empty", () => {
  const result = scopePocketImageEvidence({ patterns: [{ sourceRole: "FOUR_HOUR" }, { sourceRole: "HIGHER_TIMEFRAME" }] }, { image: chart, fourHourImage: chart });
  assert.deepEqual(result.patterns, [{ sourceRole: "FOUR_HOUR" }]);
});

test("Pattern Watch supports the primary timeframe without mapping unknown labels onto 4H", () => {
  for (const [label, expected] of [["5m", "5M"], ["15 minutes", "15M"], ["H1", "1H"], ["4 hours", "4H"], ["Daily", "1D"], ["Weekly", "1W"]]) {
    assert.equal(normalizePatternFrame(label), expected);
  }
  for (const label of ["UNKNOWN", "5m / 4h", "", "timeframe cropped"]) assert.equal(normalizePatternFrame(label), null);
});
