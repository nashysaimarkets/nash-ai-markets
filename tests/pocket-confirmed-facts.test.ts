import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";

test("actual server parser accepts ordinary trader-confirmed numeric prices", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const start = route.indexOf("    if (payload.chartConfirmation");
  const end = route.indexOf("    if (payload.accuracyCorrection", start);
  const parse = new Function("payload", stripTypeScriptTypes("function parse() { let chartConfirmation = null;" + route.slice(start, end) + "\nreturn chartConfirmation; }") + "\nreturn parse();");
  for (const currentPrice of ["7658.01", "7,658.01", "100", "-12.5"]) {
    const confirmation = { instrument: "US 500", timeframe: "30m", currentPrice, contextMatch: "NOT_PROVIDED" };
    assert.deepEqual(parse({ chartConfirmation: confirmation }), confirmation);
  }
  for (const currentPrice of ["", "NaN", "price=100", "12x", "\\d", "1..2", "1,2", "12.", "1,,000"]) {
    assert.equal(parse({ chartConfirmation: { instrument: "US 500", timeframe: "30m", currentPrice } }), null);
  }
});

test("actual precision merge preserves locked chart facts before calibration", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const start = route.indexOf('    if (analysis && typeof analysis === "object")');
  const end = route.indexOf("    const calibrated = calibratePocketAnalysis", start);
  const merge = new Function("initial", "precisionResult", "contextPrecisionResult", "chartConfirmation", "recoverPrecisionGeometry", stripTypeScriptTypes("function merge() { let analysis = initial;" + route.slice(start, end) + "\nreturn analysis; }") + "\nreturn merge();");
  const locked = { instrument: "US 500", timeframe: "30m", currentPrice: "7658.01", contextMatch: "NOT_PROVIDED" };
  const report = { instrument: "wrong", timeframe: "5m", currentPrice: "7660", levels: [], priceScaleAnchors: [] };
  for (const price of ["7662", ""]) {
    const precision = { currentPrice: price, plotBounds: { left: 5, top: 5, right: 95, bottom: 95 }, priceScaleAnchors: [], levels: [] };
    const result = merge(report, { output_text: JSON.stringify(precision) }, null, locked, recoverPrecisionGeometry);
    assert.equal(result.currentPrice, locked.currentPrice);
    assert.equal(result.instrument, locked.instrument);
    assert.equal(result.timeframe, locked.timeframe);
  }
  assert.equal(merge(report, null, null, locked, recoverPrecisionGeometry).currentPrice, locked.currentPrice);
});

test("blank current prices and blank level prices cannot satisfy both precision sides as zero", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const start = route.indexOf("    const safePrecision = async");
  const end = route.indexOf("    const [response, precisionResult", start);
  const make = new Function("requestPrecision", "recoverPrecisionGeometry", stripTypeScriptTypes(route.slice(start, end)) + "\nreturn safePrecision;");
  for (const first of [
    { currentPrice: "100", levels: [{ price: "" }, { price: "110" }] },
    { currentPrice: "100", levels: [{ price: null }, { price: "110" }] },
    { currentPrice: "", levels: [{ price: "-10" }, { price: "10" }] },
  ]) {
    let calls = 0;
    const read = make(async () => { calls++; return { output_text: JSON.stringify(first) }; }, recoverPrecisionGeometry);
    await read("image", "test", null);
    assert.equal(calls, 2);
  }
});

test('actual analyse endpoint rejects malformed supplied confirmations before provider setup', async () => {
  const route=await readFile(new URL('../app/api/pocket/analyse/route.ts',import.meta.url),'utf8');
  const source=route.slice(route.indexOf('export async function POST(')).replace('export async function','async function');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  for(const chartConfirmation of [{instrument:'US 500',timeframe:'5m',currentPrice:'1..2',contextMatch:'NOT_PROVIDED'}, 'malformed', {}, {instrument:'US 500',timeframe:'5m',currentPrice:'100',contextMatch:'UNKNOWN'}]) {
    let providers=0;
    const bindings={requirePocketScanAccess:async()=>null,NextResponse:{json:(body:unknown,options:{status:number})=>({body,...options})},INTENTIONS:['LONG','SHORT','UNSURE'],MAX_DATA_URL_LENGTH:11000000,POCKET_ANALYSIS_TIMEOUT_MS:55000,takePocketBudget:()=>({allowed:true}),createOpenAIClient:()=>{providers++;throw new Error('provider setup reached');}};
    const handler=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(source)+'\nreturn POST;')(...Object.values(bindings));
    const response=await handler(new Request('https://example.test/api/pocket/analyse',{method:'POST',body:JSON.stringify({image:'data:image/png;base64,AAAA',chartConfirmation})}));
    assert.equal(response.status,400);assert.equal(providers,0);
  }
});


test('actual analyse endpoint rejects context without explicit instrument-match confirmation', async () => {
  const route=await readFile(new URL('../app/api/pocket/analyse/route.ts',import.meta.url),'utf8');
  const source=route.slice(route.indexOf('export async function POST(')).replace('export async function','async function');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  let providers=0;
  const bindings={requirePocketScanAccess:async()=>null,NextResponse:{json:(body:unknown,options:{status:number})=>({body,...options})},INTENTIONS:['LONG','SHORT','UNSURE'],MAX_DATA_URL_LENGTH:11000000,POCKET_ANALYSIS_TIMEOUT_MS:55000,takePocketBudget:()=>({allowed:true}),createOpenAIClient:()=>{providers++;return null;}};
  const handler=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(source)+'\nreturn POST;')(...Object.values(bindings));
  const response=await handler(new Request('https://example.test/api/pocket/analyse',{method:'POST',body:JSON.stringify({image:'data:image/png;base64,AAAA',contextImage:'data:image/png;base64,BBBB',chartConfirmation:{instrument:'US 500',timeframe:'5m',currentPrice:'100',contextMatch:'NOT_PROVIDED'}})}));
  assert.equal(response.status,400);assert.equal(providers,0);
});
