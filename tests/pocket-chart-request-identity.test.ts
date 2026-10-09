import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createChartRequestEpoch } from "../app/pocket/chart-request-identity.ts";
import { stripTypeScriptTypes } from "node:module";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
};

test("actual primary upload callback ignores a FileReader that finishes after a replacement", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  const source = client.slice(client.indexOf("  async function loadFile("), client.indexOf("  async function loadContextFile("));
  const first = deferred(), second = deferred();
  const images: string[] = [];
  const epochs = { primaryUploadEpoch: { current: createChartRequestEpoch() }, contextUploadEpoch: { current: createChartRequestEpoch() }, analysisEpoch: { current: createChartRequestEpoch() } };
  const noop = () => {};
  const bindings = {
    ...epochs, MAX_IMAGE_BYTES: 100, prepareImage: (file: { name: string }) => file.name === "A" ? first.promise : second.promise,
    setImage: (image: string) => images.push(image), setFileName: noop, setError: noop, setAnalysis: noop, setBattlefieldChart: noop,
    setPreflightStatus: noop, setChartConfirmation: noop, invalidateChartWork: () => epochs.analysisEpoch.current.invalidate(),
  };
  const run = new AsyncFunction(...Object.keys(bindings), stripTypeScriptTypes(source) + "\nreturn loadFile;");
  const upload = await run(...Object.values(bindings));
  const event = (name: string) => ({ target: { files: [{ name, type: "image/png", size: 1 }] } });
  const old = upload(event("A")), latest = upload(event("B"));
  second.resolve("chart-B"); await latest;
  first.resolve("chart-A"); await old;
  assert.deepEqual(images, ["chart-B"]);
});

test("an earlier FileReader completion cannot replace a newer chart", () => {
  const epoch = createChartRequestEpoch();
  const oldRead = epoch.begin();
  const newRead = epoch.begin();
  assert.equal(epoch.isCurrent(oldRead), false);
  assert.equal(epoch.isCurrent(newRead), true);
});

test("a response started for chart A cannot be applied after chart B is selected", () => {
  const epoch = createChartRequestEpoch();
  const chartA = epoch.snapshot();
  assert.equal(epoch.isCurrent(chartA), true);
  epoch.invalidate();
  assert.equal(epoch.isCurrent(chartA), false);
});

test("Pocket client guards FileReader and analysis responses by chart identity", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /primaryUploadEpoch\.current\.begin\(\)/);
  assert.match(client, /contextUploadEpoch\.current\.begin\(\)/);
  assert.match(client, /analysisEpoch\.current\.invalidate\(\)/);
  assert.match(client, /primaryUploadEpoch\.current\.isCurrent\(readToken\)/);
  assert.match(client, /contextUploadEpoch\.current\.isCurrent\(readToken\)/);
  assert.match(client, /analysisEpoch\.current\.isCurrent\(requestToken\)/);
  assert.match(client, /setPreflightStatus\("CHECKING"\)/);
  assert.match(client, /setChartConfirmation\(null\)/);
});

test("old preflight callbacks are cancelled after image replacement", async () => {
  const panel = await readFile(new URL("../app/pocket/ChartPreflightPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /controller\.abort\(\)/);
  assert.match(panel, /if \(!active\) return/);
});
