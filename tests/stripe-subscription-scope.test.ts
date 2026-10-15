import assert from "node:assert/strict";
import test from "node:test";
import { singleConfiguredSubscriptionItem, containsPocketPrice } from "../app/lib/stripe-subscription-scope.ts";

const env = {
  STRIPE_POCKET_FOUNDING_PRICE_ID: "price_pocket",
  STRIPE_PRO_PRICE_ID: "price_pro",
  STRIPE_ELITE_PRICE_ID: "price_elite",
};
const price = (id:string) => ({price:{id,unit_amount:499}});

test("valid exact Pocket price grants one unambiguous subscription item", () => {
  const result = singleConfiguredSubscriptionItem([price("price_pocket")], env);
  assert.equal(result?.offering.plan, "pocket");
  assert.equal(result?.item.price.id,"price_pocket");
});

test("a known Pocket item cannot conceal an unrecognised second price", () => {
  for(const items of [[price("price_pocket"),price("price_unknown")],
                     [price("price_unknown"),price("price_pocket")]]) {
    assert.equal(singleConfiguredSubscriptionItem(items,env),null);
    assert.equal(containsPocketPrice(items,env),true);
  }
});

test("mixed, duplicate, empty and unknown subscription items are never unambiguous", () => {
  for(const items of [[],[price("price_unknown")],
                      [price("price_pocket"),price("price_pro")],
                      [price("price_pocket"),price("price_pocket")],
                      [price("price_pro"),price("price_unknown")]]) {
    assert.equal(singleConfiguredSubscriptionItem(items,env),null);
  }
});

test("legacy non-Pocket checkout must not require Pocket-only identity", () => {
  assert.equal(containsPocketPrice([price("price_pro")],env),false);
  assert.equal(containsPocketPrice([price("price_elite")],env),false);
  assert.equal(containsPocketPrice([price("price_unknown")],env),false);
  assert.equal(containsPocketPrice([price("price_pocket")],env),true);
});

test("duplicated price IDs with contradictory offering definitions fail closed", () => {
  const invalid = {...env,STRIPE_PRO_PRICE_ID:"price_pocket"};
  assert.equal(singleConfiguredSubscriptionItem([price("price_pocket")],invalid),null);
  assert.equal(containsPocketPrice([price("price_pocket")],invalid),false);
});
