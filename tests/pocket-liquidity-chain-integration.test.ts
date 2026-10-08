import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

const observations = [
  {kind:"equal-highs",side:"buy-side",x:25,y:30,confidence:"HIGH"},
  {kind:"equal-highs",side:"buy-side",x:60,y:30,confidence:"HIGH"},
];
function run(points: unknown, overrides: Record<string,unknown> = {}, liquidityOverrides: Record<string,unknown> = {}) {
  return calibratePocketAnalysis({
    evidenceQuality:{chartReadability:"CLEAR",candlesReadable:true,scaleReadable:true,instrumentConfidence:"HIGH",timeframeConfidence:"HIGH"},
    plotBounds:{left:5,top:10,right:90,bottom:90},
    priceScaleAnchors:[{price:7800,y:20},{price:7650,y:50},{price:7500,y:80}],
    liquidity:{state:"VERIFIED",event:"NONE",confidence:"HIGH",evidence:"Repeated visible highs",confirmation:"Price reacts below",invalidation:"Price accepts above",
      observations:points,zones:[{side:"BUY_SIDE",basis:"EQUAL_HIGHS",price:"7750",x:18,x2:82,y:30}],...liquidityOverrides},
    ...overrides,
  }) as {liquidity:{state:string;zones:unknown[];evidenceChain:{status:string;reasons:string[]}}};
}

test("production liquidity is verified only with independent spatial screenshot observations", () => {
  const result = run(observations);
  assert.equal(result.liquidity.state,"VERIFIED");
  assert.equal(result.liquidity.evidenceChain.status,"VERIFIED");
});

test("zone endpoints and prose cannot substitute for missing or duplicate evidence", () => {
  for (const points of [undefined,[],[observations[0]],[observations[0],{...observations[0],x:26}]]) {
    const result = run(points);
    assert.equal(result.liquidity.state,"PARTIAL");
    assert.equal(result.liquidity.evidenceChain.status,"BLOCKED");
    assert.equal(result.liquidity.zones.length,1);
  }
});

test("a verified chain on another row, side or outside the zone does not verify this zone", () => {
  for (const points of [
    observations.map(point=>({...point,y:50})),
    observations.map(point=>({...point,kind:"equal-lows",side:"sell-side"})),
    observations.map((point,index)=>({...point,x:index?16:6})),
  ]) assert.equal(run(points).liquidity.state,"PARTIAL");
});

test("malformed and out-of-plot observations fail closed without throwing", () => {
  for (const points of [[null],{},[{...observations[0],x:NaN}],observations.map(point=>({...point,y:2})),
    [{...observations[0],kind:"hidden-orders"},observations[1]]]) {
    assert.equal(run(points).liquidity.state,"PARTIAL");
  }
});

test("unclear charts and unverified bounds cannot earn an Evidence Chain verification", () => {
  assert.equal(run(observations,{evidenceQuality:{chartReadability:"PARTIAL",candlesReadable:true}}).liquidity.state,"PARTIAL");
  assert.equal(run(observations,{plotBounds:undefined}).liquidity.state,"PARTIAL");
  assert.equal(run(observations,{levels:[],plotBounds:{left:"5",top:10,right:90,bottom:90}}).liquidity.state,"PARTIAL");
  assert.equal(run(observations.map(point=>({...point,side:"sell-side"}))).liquidity.state,"PARTIAL");
});

test("the provider schema and prompt request real observations rather than invented endpoint evidence", () => {
  const route = readFileSync(new URL("../app/api/pocket/analyse/route.ts",import.meta.url),"utf8");
  assert.match(route,/observations: \{/);
  assert.match(route,/"zones", "observations"/);
  assert.match(route,/Never manufacture observations from zone endpoints/);
});

test("Evidence Chain never upgrades a NONE or PARTIAL provider state", () => {
  assert.equal(run(observations,{}, {state:"NONE"}).liquidity.state,"NONE");
  assert.equal(run(observations,{}, {state:"PARTIAL"}).liquidity.state,"PARTIAL");
});

test("one corroborated zone cannot verify a second uncorroborated displayed zone", () => {
  assert.equal(run(observations,{}, {zones:[
    {side:"BUY_SIDE",basis:"EQUAL_HIGHS",price:"7750",x:18,x2:82,y:30},
    {side:"SELL_SIDE",basis:"EQUAL_LOWS",price:"7600",x:18,x2:82,y:60},
  ]}).liquidity.state,"PARTIAL");
});
