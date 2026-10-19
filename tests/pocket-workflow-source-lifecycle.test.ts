import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function workflowFixture() {
  const source = await readFile(new URL("../app/pocket-next/PocketWorkflowDesk.tsx", import.meta.url), "utf8");
  const start = source.indexOf(" useEffect(()=>()=>{");
  const end = source.indexOf(" const refresh=async", start);
  assert.ok(start >= 0 && end > start, "exercise the real cancellation, transport and image-load handlers");
  const image = deferred<string>();
  const response = deferred<{ ok: boolean; json: () => Promise<Record<string, unknown>> }>();
  const imageReads = [image];
  const replies = [response];
  let dispose = () => {};
  const state = {
    after: "previous-after-image", reviewPrivacy: true, review: null as unknown,
    labImage: "previous-lab-image", labPrivacy: true, labFacts: { instrument: "OLD" } as unknown,
    labStatus: "LOCKED", labResult: { name: "previous-level-result" } as unknown, labRevision: 0,
    busy: "", error: "", notice: "", reading: false, writes: 0,
    requests: [] as Array<{ route: string; body: unknown; signal: AbortSignal | null | undefined }>,
  };
  const bindings = {
    useEffect: (setup: () => () => void) => { dispose = setup(); },
    generation: { current: 0 }, pending: { current: null as AbortController | null }, pendingRoute: { current: "" },
    labRevision: { current: 0 }, sourceLoad: { current: null as number | null },
    setBusy: (value: string) => { state.writes++; state.busy = value; },
    setError: (value: string) => { state.writes++; state.error = value; },
    setNotice: (value: string) => { state.writes++; state.notice = value; },
    setReading: (value: boolean) => { state.writes++; state.reading = value; },
    setAfter: (value: string) => { state.writes++; state.after = value; },
    setReview: (value: unknown) => { state.writes++; state.review = value; },
    setReviewPrivacy: (value: boolean) => { state.writes++; state.reviewPrivacy = value; },
    setCurrentLabRevision: (value: number) => { state.writes++; state.labRevision = value; },
    setLabImage: (value: string) => { state.writes++; state.labImage = value; },
    setLabResult: (value: unknown) => { state.writes++; state.labResult = value; },
    setLabStatus: (value: string) => { state.writes++; state.labStatus = value; },
    setLabFacts: (value: unknown) => { state.writes++; state.labFacts = value; },
    setLabPrivacy: (value: boolean) => { state.writes++; state.labPrivacy = value; },
    readWorkflowImage: () => imageReads.shift()!.promise,
    pocketAuthenticatedFetch: async (route: string, init: RequestInit) => {
      state.requests.push({ route, body: JSON.parse(String(init.body)), signal: init.signal });
      return replies.shift()!.promise;
    },
  };
  const body = stripTypeScriptTypes(source.slice(start, end));
  const handlers = new Function(...Object.keys(bindings), body + "\nreturn {load,perform,cancel};")(...Object.values(bindings)) as {
    load: (file: File, kind: "after" | "lab") => Promise<void>;
    perform: (route: string, body: unknown | (() => Promise<unknown>), receive: (payload: Record<string, unknown>) => void) => Promise<void>;
    cancel: () => void;
  };
  return {
    state, image, response, bindings, ...handlers, dispose: () => dispose(),
    queueImage: () => { const next = deferred<string>(); imageReads.push(next); return next; },
  };
}

test("replacing an after-image cannot dispatch the old review while the new source is being read", async () => {
  const fixture = await workflowFixture();
  const replacing = fixture.load(new File(["replacement"], "after.png", { type: "image/png" }), "after");
  const oldRequest = fixture.perform("review", { afterImage: fixture.state.after }, payload => { fixture.state.review = payload.review; });
  fixture.image.resolve("new-after-image"); await replacing;
  fixture.response.resolve({ ok: true, json: async () => ({ review: { headline: "REVIEW OF PREVIOUS IMAGE" } }) });
  await oldRequest;
  assert.equal(fixture.state.after, "new-after-image");
  assert.equal(fixture.state.reviewPrivacy, false);
  assert.equal(fixture.state.review, null, "a previous image's review must never appear beneath the replacement");
  assert.equal(fixture.state.requests.length, 0, "no provider-bound review may start during replacement decoding");
});

test("Level Lab replacement holds requests until the new source, facts and separate privacy are reset", async () => {
  const fixture = await workflowFixture();
  const replacing = fixture.load(new File(["replacement"], "lab.png", { type: "image/png" }), "lab");
  assert.equal(fixture.state.reading, true);
  await fixture.perform("levels", { image: fixture.state.labImage }, payload => { fixture.state.labResult = payload.levels; });
  assert.equal(fixture.state.requests.length, 0);
  fixture.image.resolve("new-lab-image"); await replacing;
  assert.equal(fixture.state.labImage, "new-lab-image");
  assert.equal(fixture.state.labFacts, null);
  assert.equal(fixture.state.labPrivacy, false);
  assert.equal(fixture.state.labStatus, "IDLE");
  assert.equal(fixture.state.labResult, null);
  assert.equal(fixture.state.reading, false);
});

test("failed image reads retain the previous consent and report and release the request hold", async () => {
  const fixture = await workflowFixture();
  const previous = { headline: "previous verified source" };
  fixture.state.review = previous;
  const replacing = fixture.load(new File(["broken"], "after.png", { type: "image/png" }), "after");
  fixture.image.reject(new Error("Cannot decode image")); await replacing;
  assert.equal(fixture.state.after, "previous-after-image");
  assert.equal(fixture.state.reviewPrivacy, true);
  assert.equal(fixture.state.review, previous);
  assert.equal(fixture.state.reading, false);
  assert.equal(fixture.bindings.sourceLoad.current, null);
  assert.match(fixture.state.error, /previous selection was kept/);
  const retry = fixture.perform("review", { afterImage: fixture.state.after }, payload => { fixture.state.review = payload.review; });
  fixture.response.resolve({ ok: true, json: async () => ({ review: { headline: "retry for retained source" } }) });
  await retry;
  assert.equal(fixture.state.requests.length, 1);
  assert.deepEqual(fixture.state.review, { headline: "retry for retained source" });
});

test("an obsolete image read cannot release a newer replacement hold or overwrite its source", async () => {
  const fixture = await workflowFixture();
  const latestImage = fixture.queueImage();
  const first = fixture.load(new File(["old"], "first.png", { type: "image/png" }), "after");
  const second = fixture.load(new File(["new"], "second.png", { type: "image/png" }), "after");
  fixture.image.resolve("obsolete-image"); await first;
  assert.equal(fixture.state.after, "previous-after-image");
  assert.equal(fixture.state.reading, true);
  assert.notEqual(fixture.bindings.sourceLoad.current, null);
  latestImage.resolve("latest-image"); await second;
  assert.equal(fixture.state.after, "latest-image");
  assert.equal(fixture.state.reading, false);
});

test("cancelling a local replacement preserves the old source and ignores its later decode", async () => {
  const fixture = await workflowFixture();
  const replacing = fixture.load(new File(["new"], "after.png", { type: "image/png" }), "after");
  fixture.cancel();
  assert.equal(fixture.state.reading, false);
  assert.match(fixture.state.notice, /Image replacement cancelled/);
  const writes = fixture.state.writes;
  fixture.image.resolve("cancelled-image"); await replacing;
  assert.equal(fixture.state.after, "previous-after-image");
  assert.equal(fixture.state.reviewPrivacy, true);
  assert.equal(fixture.state.writes, writes);
});

test("replacement aborts an existing review and rejects a late reply from an abort-ignoring transport", async () => {
  const fixture = await workflowFixture();
  const request = fixture.perform("review", { afterImage: fixture.state.after }, payload => { fixture.state.review = payload.review; });
  const replacing = fixture.load(new File(["new"], "after.png", { type: "image/png" }), "after");
  assert.equal(fixture.state.requests[0].signal?.aborted, true);
  fixture.image.resolve("new-after-image"); await replacing;
  fixture.response.resolve({ ok: true, json: async () => ({ review: "STALE REVIEW" }) }); await request;
  assert.equal(fixture.state.after, "new-after-image");
  assert.equal(fixture.state.review, null);
  assert.equal(fixture.state.error, "");
});

test("cancelled crop preparation cannot dispatch later or clear a newer tool's busy state", async () => {
  const fixture = await workflowFixture();
  const crop = deferred<unknown>();
  const old = fixture.perform("levels", () => crop.promise, () => assert.fail("stale crop accepted"));
  const replacing = fixture.load(new File(["new"], "lab.png", { type: "image/png" }), "lab");
  fixture.image.resolve("new-lab-image"); await replacing;
  const current = fixture.perform("follow-up", { question: "Current report?" }, () => {});
  crop.resolve({ image: "old-image", precisionImage: "old-crop" }); await old;
  assert.equal(fixture.state.requests.length, 1);
  assert.equal(fixture.state.requests[0].route, "/api/pocket/follow-up");
  assert.equal(fixture.state.busy, "follow-up");
  fixture.response.resolve({ ok: true, json: async () => ({ reply: "current" }) }); await current;
  assert.equal(fixture.state.busy, "");
});

test("actual cleanup suppresses post-unmount image and request-finally state updates", async () => {
  const imageFixture = await workflowFixture();
  const replacing = imageFixture.load(new File(["new"], "after.png", { type: "image/png" }), "after");
  imageFixture.dispose(); const imageWrites = imageFixture.state.writes;
  imageFixture.image.resolve("unmounted-image"); await replacing;
  assert.equal(imageFixture.state.writes, imageWrites);

  const requestFixture = await workflowFixture();
  const request = requestFixture.perform("review", { afterImage: "old" }, () => assert.fail("unmounted request accepted"));
  requestFixture.dispose(); const requestWrites = requestFixture.state.writes;
  assert.equal(requestFixture.state.requests[0].signal?.aborted, true);
  requestFixture.response.resolve({ ok: true, json: async () => ({ review: "old" }) }); await request;
  assert.equal(requestFixture.state.writes, requestWrites);
});
