/** Mounted recovery integration: real raster/detector/helpers; controlled OCR boundary. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const sourceRoot = resolve(process.env.POCKET_QA_SOURCE_ROOT || process.cwd());
const require = createRequire(sourceRoot + '/package.json');
const entry = resolve(process.env.POCKET_QA_IMAGE_RECOVERY_ENTRY || sourceRoot + '/tests/support/pocket-image-recovery-browser.tsx');
const output = resolve(process.env.POCKET_QA_IMAGE_RECOVERY_OUT || sourceRoot + '/qa/scanner-image-recovery/browser-lifecycle.json');
const { build } = await import(process.env.POCKET_QA_ESBUILD_MODULE || pathToFileURL(require.resolve('esbuild')).href);
const playwright = await import(process.env.POCKET_QA_PLAYWRIGHT_MODULE || pathToFileURL(require.resolve('playwright')).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;
assert.equal(typeof chromium?.launch, 'function');
const sourceFiles = [
  'app/pocket/use-original-chart-measurement.ts', 'app/pocket/source-placement.ts', 'app/pocket/OriginalChartEvidence.tsx',
  'app/pocket/image-plot-region.ts', 'app/pocket/image-axis-verification.ts', 'app/pocket/source-price-candidates.ts',
  'app/pocket/original-pixel-levels.ts', 'app/pocket/original-pixel-geometry.ts', 'app/pocket/axis-verification.ts',
  'app/pocket/axis-reading-bounds.ts', 'app/pocket/chart-grid-rows.ts', 'app/pocket/candle-pixels.ts',
  'tests/support/pocket-image-plot-raster.ts', 'tests/support/pocket-image-recovery-browser.tsx', 'tests/run-pocket-image-recovery-browser.mjs',
];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async path =>
  [path, createHash('sha256').update(await readFile(sourceRoot + '/' + path)).digest('hex')])));
const sourceHashes = await hashes();
const built = await build({
  stdin: { contents: await readFile(entry, 'utf8'), loader: 'tsx', resolveDir: sourceRoot + '/tests/support', sourcefile: 'pocket-image-recovery-browser.tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
  nodePaths: [sourceRoot + '/node_modules'], loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
  plugins: [{ name: 'controlled-independent-image-ocr', setup(builder) {
    builder.onResolve({ filter: /browser-image-axis-ocr(?:\.ts)?$/ }, () => ({ path: 'image-reader', namespace: 'recovery-review' }));
    builder.onResolve({ filter: /browser-axis-ocr(?:\.ts)?$/ }, () => ({ path: 'legacy-reader', namespace: 'recovery-review' }));
    builder.onLoad({ filter: /image-reader/, namespace: 'recovery-review' }, () => ({ loader: 'js', contents: `
      window.__imageRecoveryAxisCalls=[];
      export function verifyImagePriceAxis(image,region,modelPrices,signal){
        return new Promise((resolve,reject)=>window.__imageRecoveryAxisCalls.push({
          src:image.src,width:image.naturalWidth,height:image.naturalHeight,region,modelPrices:[...modelPrices],signal,resolve,reject
        }));
      }` }));
    builder.onLoad({ filter: /legacy-reader/, namespace: 'recovery-review' }, () => ({ loader: 'js', contents: `
      window.__imageRecoveryLegacyCalls=[];
      export function verifyOriginalAxis(image,bounds,rows,model,signal){
        window.__imageRecoveryLegacyCalls.push({src:image.src,signal});
        return Promise.resolve({status:'held',reason:'Unexpected legacy OCR call in recovery-only harness.'});
      }` }));
  } }],
});
assert.deepEqual(await hashes(), sourceHashes, 'Source changed while building the browser test bundle.');
const bundle = built.outputFiles[0].contents;
const sourceBuild = { sourceHashes, bundleSha256: createHash('sha256').update(bundle).digest('hex'), bundleBytes: bundle.length,
  controlledBoundaries: ['browser-image-axis-ocr (deferred responses)', 'browser-axis-ocr (counted forbidden calls)'],
  realProductionPaths: ['React hook', 'image raster detector', 'axis word verifier', 'candidate projection', 'OriginalChartEvidence'], providerCalls: 0 };
if (process.env.POCKET_QA_BROWSER_COMPILE_ONLY === '1') {
  console.log(JSON.stringify({ status: 'COMPILED_BROWSER_UNRUN', ...sourceBuild })); process.exit(0);
}
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/recovery.js"></script></body></html>';
const server = createServer((request, response) => {
  if (request.url === '/recovery.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(bundle); }
  else if (request.url === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end(html); }
  else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const checks = [], errors = [], blockedExternalRequests = [];
let browser, browserVersion, observations;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  browserVersion = browser.version();
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:')) return route.continue();
    blockedExternalRequests.push(url); return route.abort();
  });
  await page.goto(origin, { waitUntil: 'load' });
  const calls = () => page.evaluate(() => window.__imageRecoveryAxisCalls.length);
  const snapshot = () => page.evaluate(() => window.imageRecoveryReview.snapshot());
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const waitCalls = async expected => {
    await page.waitForFunction(n => window.__imageRecoveryAxisCalls.length === n, expected);
    assert.equal(await calls(), expected);
  };
  const count = async expected => page.waitForFunction(n => document.querySelector('#recovery-placement')?.getAttribute('data-count') === String(n), expected);
  const noLevels = async () => { await count(0); assert.equal(await page.locator('#level-views svg line').count(), 0); };
  const noOtherAuthority = async () => {
    const value = await snapshot(); assert.equal(value.legacyAxis, 'held'); assert.equal(value.pixelsNull, true);
    assert.equal(await page.locator('#pattern-view svg, #liquidity-view svg').count(), 0);
  };
  const lineRows = () => page.locator('#level-views svg line').evaluateAll(lines => lines.map(line => [
    Number(line.getAttribute('x1')), Number(line.getAttribute('x2')), Number(line.getAttribute('y1')), Number(line.getAttribute('y2')),
  ]));
  const expectedLines = async (row, consumers = 2) => {
    const lines = await lineRows(); assert.equal(lines.length, consumers);
    for (const actual of lines) for (const [i, expected] of [60, 590, row, row].entries()) assert.ok(Math.abs(actual[i] - expected) < 1e-8, JSON.stringify(actual));
  };
  const freshCall = async action => {
    const before = await calls(); await action(); await waitCalls(before + 1); await noLevels(); return before;
  };
  const complete = async (index, mode = 'valid') => { await page.evaluate(({ index, mode }) => window.imageRecoveryReview.resolve(index, mode), { index, mode }); };
  const check = async (name, run) => {
    try {
      await run();
      assert.equal(await page.evaluate(() => window.__imageRecoveryLegacyCalls.length), 0, 'Recovery-only reports must never call legacy OCR.');
      checks.push({ name, status: 'PASS' });
    } catch (error) { checks.push({ name, status: 'FAIL', error: String(error?.message || error) }); throw error; }
  };

  await check('pending real-image measurement holds both consumers and uses only the new OCR boundary', async () => {
    await waitCalls(1); await noLevels();
    assert.equal(await page.locator('#level-views .psOriginalEvidence').count(), 2);
    const first = await page.evaluate(() => {
      const c = window.__imageRecoveryAxisCalls[0];
      return { sameImage: c.src === window.imageRecoveryReview.images.a, width: c.width, height: c.height,
        region: c.region.status === 'measured' ? c.region.plotPixels : c.region, modelPrices: c.modelPrices };
    });
    assert.deepEqual(first, { sameImage: true, width: 720, height: 480, region: { left: 60, right: 590, top: 55, bottom: 350 }, modelPrices: [12345, 11720] });
  });
  await check('real verifier projects retained prices for two shared SVG views without granting semantic authority', async () => {
    await complete(0); await count(1); await expectedLines(202.5); assert.equal(await calls(), 1);
    const value = await snapshot(); assert.equal(value.placement, 'IMAGE_AXIS'); assert.equal(value.provenance, 'UNVERIFIED');
    assert.equal(value.recoveryAxis, 'verified'); await noOtherAuthority();
  });
  await check('valid model bounds with false quality still grant no pattern or liquidity authority', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report('valid_bounds')));
    await complete(index); await count(1); await expectedLines(202.5); await noOtherAuthority();
  });
  await check('identity revocation removes all placements synchronously', async () => {
    const value = await page.evaluate(() => {
      window.imageRecoveryReview.replace({ identity: false });
      return { count: document.querySelector('#recovery-placement').getAttribute('data-count'), lines: document.querySelectorAll('svg line').length };
    });
    assert.deepEqual(value, { count: '0', lines: 0 });
  });
  await check('reconfirming the same source waits for a fresh measurement', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.replace({ identity: true })));
    await complete(index); await count(1); await expectedLines(202.5);
  });
  let confirmationCall;
  await check('a changed confirmation object invalidates the current image and report measurement', async () => {
    confirmationCall = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.reconfirm()));
  });
  await check('a late old-report response is ignored even when the controlled transport ignores abort', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report('candidate', '12157.50')));
    assert.equal(await page.evaluate(i => window.__imageRecoveryAxisCalls[i].signal.aborted, confirmationCall), true);
    await complete(confirmationCall); await settle(); await noLevels();
    await complete(index); await count(1); await expectedLines(143.5);
  });
  await check('image A to B to A never revives an old image result', async () => {
    const other = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.replace({ image: window.imageRecoveryReview.images.b })));
    assert.deepEqual(await page.evaluate(i => window.__imageRecoveryAxisCalls[i].region.plotPixels, other), { left: 190, right: 810, top: 110, bottom: 510 });
    const current = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.replace({ image: window.imageRecoveryReview.images.a })));
    assert.equal(await page.evaluate(i => window.__imageRecoveryAxisCalls[i].signal.aborted, other), true);
    await complete(other); await settle(); await noLevels();
    await complete(current); await count(1); await expectedLines(143.5);
  });
  await check('revocation during a pending read blocks its completion after reconfirmation', async () => {
    const old = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report()));
    await page.evaluate(() => window.imageRecoveryReview.replace({ identity: false })); await noLevels();
    assert.equal(await page.evaluate(i => window.__imageRecoveryAxisCalls[i].signal.aborted, old), true);
    const current = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.replace({ identity: true })));
    await complete(old); await settle(); await noLevels();
    await complete(current); await count(1); await expectedLines(202.5);
  });
  for (const [mode, name] of [
    ['unsupported_scale', 'explicit logarithmic scale holds before either OCR reader'],
    ['malformed_limitations', 'malformed scale limitations hold before either OCR reader'],
    ['malformed_envelope', 'a malformed candidate authority envelope holds before either OCR reader'],
  ]) await check(name, async () => {
    const before = await calls(); await page.evaluate(mode => window.imageRecoveryReview.report(mode), mode);
    await settle(); await noLevels(); assert.equal(await calls(), before); assert.equal((await snapshot()).measured, false);
  });
  await check('ambiguous touching panels publish a terminal hold without invoking OCR', async () => {
    const before = await calls(); await page.evaluate(() => window.imageRecoveryReview.configure('ambiguous'));
    await page.waitForFunction(() => window.imageRecoveryReview.snapshot().measured); await noLevels();
    const value = await snapshot(); assert.equal(value.regionStatus, 'held'); assert.equal(value.recoveryAxis, null);
    assert.doesNotMatch(value.reason, /verifying/i); assert.equal(await calls(), before); await noOtherAuthority();
  });
  await check('an over-budget original image holds before canvas readback and OCR', async () => {
    const before = await calls(), reads = await page.evaluate(() => window.__imageRecoveryReadbacks.length);
    await page.evaluate(() => window.imageRecoveryReview.configure('oversized'));
    await page.waitForFunction(() => window.imageRecoveryReview.snapshot().measured); await noLevels();
    assert.equal(await calls(), before); assert.equal(await page.evaluate(() => window.__imageRecoveryReadbacks.length), reads);
    assert.match((await snapshot()).reason, /too large/i); await noOtherAuthority();
  });
  await check('an explicit independent OCR hold cannot reuse earlier placements', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.configure('a')));
    await complete(index, 'held'); await page.waitForFunction(() => window.imageRecoveryReview.snapshot().measured); await noLevels();
    assert.match((await snapshot()).reason, /CONTROLLED INDEPENDENT OCR HOLD/); await noOtherAuthority();
  });
  await check('a rejected independent read remains held without authority widening', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report()));
    await page.evaluate(i => window.imageRecoveryReview.reject(i), index);
    await page.waitForFunction(() => window.imageRecoveryReview.snapshot().measured); await noLevels();
    assert.match((await snapshot()).reason, /reader unavailable/i); await noOtherAuthority();
  });
  await check('nonlinear controlled OCR words fail the real axis verifier in the mounted flow', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report()));
    await complete(index, 'nonlinear'); await page.waitForFunction(() => window.imageRecoveryReview.snapshot().measured); await noLevels();
    assert.match((await snapshot()).reason, /linear pixel fit/i); await noOtherAuthority();
  });
  await check('a bare verified-axis envelope cannot grant source placement', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report()));
    await complete(index, 'malformed_axis'); await page.waitForFunction(() => window.imageRecoveryReview.snapshot().measured); await noLevels();
    assert.match((await snapshot()).reason, /does not belong/i); await noOtherAuthority();
  });
  await check('removing a shared view neither restarts OCR nor creates a render loop', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report()));
    await complete(index); await count(1); await page.evaluate(() => window.imageRecoveryReview.replace({ consumers: 1 }));
    await expectedLines(202.5, 1); assert.equal(await calls(), index + 1);
    await settle(); const stable = (await snapshot()).renderCount; await settle(); assert.equal((await snapshot()).renderCount, stable);
  });
  await check('unmount aborts a pending read and ignores its later completion', async () => {
    const index = await freshCall(() => page.evaluate(() => window.imageRecoveryReview.report()));
    await page.evaluate(() => window.imageRecoveryReview.unmount());
    assert.equal(await page.evaluate(i => window.__imageRecoveryAxisCalls[i].signal.aborted, index), true);
    await complete(index); await settle(); assert.equal(await page.locator('#root').textContent(), '');
  });
  await check('no browser exceptions, legacy reader calls or external requests occurred', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(blockedExternalRequests, []);
  });
  observations = await page.evaluate(() => ({ independentReaderCalls: window.__imageRecoveryAxisCalls.length,
    legacyReaderCalls: window.__imageRecoveryLegacyCalls.length, originalRasterReadbacks: window.__imageRecoveryReadbacks.length }));
} catch (error) {
  errors.push(String(error?.stack || error)); process.exitCode = 1;
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  const receipt = { kind: 'POCKET_SCANNER_IMAGE_RECOVERY_BROWSER_LIFECYCLE', status: process.exitCode ? 'FAIL' : 'PASS',
    observedAtUtc: new Date().toISOString(), browserVersion, checks, errors, blockedExternalRequests, observations, sourceBuild,
    providerCalls: 0, databaseCalls: 0, privateChartReads: 0, heldOutReads: 0, screenshots: 0,
    limitations: ['Synthetic public chart rasters and controlled OCR boundary; this checks mounted binding and authority behavior, not real OCR/scanner accuracy or physical-device latency.'] };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...receipt }));
}
