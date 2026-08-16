import assert from "node:assert/strict";
import test from "node:test";
import { calculateClassicPivotLevels } from "../app/dashboard/lib/personal-pivots.ts";

test("classic pivot calculator derives the full R3 to S3 ladder deterministically", () => {
  assert.deepEqual(calculateClassicPivotLevels({ high: 110, low: 100, close: 105 }), {
    R3: "120.00",
    R2: "115.00",
    R1: "110.00",
    PIVOT: "105.00",
    S1: "100.00",
    S2: "95.00",
    S3: "90.00",
  });
});

test("classic pivot calculator accepts formatted values and rejects unsafe session inputs", () => {
  assert.equal(calculateClassicPivotLevels({ high: "6,200", low: "6,100", close: "6,150" })?.PIVOT, "6150.00");
  assert.equal(calculateClassicPivotLevels({ high: 100, low: 100, close: 100 }), null);
  assert.equal(calculateClassicPivotLevels({ high: 110, low: 100, close: 120 }), null);
  assert.equal(calculateClassicPivotLevels({ high: "bad", low: 100, close: 105 }), null);
  assert.equal(calculateClassicPivotLevels({ high: 2, low: 1, close: 1 }), null);
});
