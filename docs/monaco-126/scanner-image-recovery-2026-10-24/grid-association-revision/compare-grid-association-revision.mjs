#!/usr/bin/env node
// Offline, read-only scoring of five already completed, immutable browser runs.
// Usage: node compare-grid-association-revision.mjs [workspace] [new-output-directory]
// Only calibration entries are decoded. No image, browser, provider, or key code runs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const workspace = resolve(process.argv[2] ?? '/workspace/scratch/616faf3e8649');
const evidence = resolve(workspace, 'scanner-image-geometry-repair-evidence');
const revision = resolve(evidence, 'grid-association-revision');
const output = resolve(process.argv[3] ?? revision);
const app = resolve(workspace, 'scanner-image-geometry-repair');
const hash = value => createHash('sha256').update(value).digest('hex');
const need = (condition, message) => assert.ok(condition, message);
function pinned(path, expected) {
  const bytes = readFileSync(path);
  assert.equal(hash(bytes), expected, 'Hash mismatch: ' + path);
  return bytes;
}
const json = (path, expected) => JSON.parse(pinned(path, expected));
const relativePath = path => relative(workspace, path);
const max = values => Math.max(0, ...values);
const tolerance = 1;
const pins = {
  manifest: 'b9bebc8ba984ed94a30618eefaacca5cc6e1c4de000a9c10444c698cde20653f',
  sourceAcceptance: 'bee9550dab60a5e867f1b162eae02d427abb4f0ce9854406b33292eb65862766',
  inputAdmission: '66c2513f7e795b0dbabe3a66353e6080b7d1c7f93d11eda931c382d98be2a9b0',
  preparation: 'a5b4a9f9b5a2651e01bb78d876af3c5479ea6f38e092d364b75a7f0f68b6fda9',
  plan: 'cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109',
  driver: '89901242f9e0c7e8eb0df38640e41464d2fdea81f37ec932a915b734faaba02b',
  collector: '11eae8db2659fb12f1bfadf0463249d05ade7ef9003a50e55a7163cc05049f50',
  parser: '6e0a2e2d53cc062c9275107494ac658b217cf03e4e6f74756c4f48ec01c9f252',
  helper: '1689f43e6d2ea88e7aba96e44b5d802d441240b99bfbc1fa28368b3584cdebb2',
  detector: '819917bd5e09ed696a66cff61eaad6aa3e4d32940f18a38002850d4dfa523c48',
  protocol: '4386a29b59718138437ddaf5d0a53b3c77f442acf161e8472aac45cee7773bf5',
  reference: '06fd2b201ecefbda4c7746a24ea5c5470e8679fdee2740dcac81cd3c5f8dd424',
};
const observations = {
  d001: 'b8cf757d66d28d0d19578dc2ef04f1276aa8deba15bc76544f8032fdf3d1fd94',
  d002: 'c9097d897f9a002ae2a6b58c7dd19c073531bb5e70d42c460f147fa46ee0ad43',
  d003: 'd11aae5fdbd6941a293732ea278af394002b1c8591ceac975fcbb9f681c8954d',
  d004: 'd3668196c8698f6edb43186cea8ad89bae818f1f7de89c46db40300364792864',
  d006: '3b65894756b72987edaff8395af31e7e19c0c700d2ae56a14c87a0af2ddb98ec',
};
const calibrationPins = {
  d001: 'e57e1420368b454f6751580d87641c052ca754c6abb6e2baf04109676f3171ae',
  d002: 'a209504af5d82a9bb07a43060ad5230e8292a3bd5af22a87c0414198871398a0',
  d003: 'f952870c93060e0f630e9a694471fe82d39316cc995bd1aa850c98babf579ff9',
  d004: 'e34dda4f56c636f79315890ca9fd6b6611b3b1424387984e191fdd3af07864e4',
  d006: 'e97131915a680f15211a870b17745387230e65ba2fec5580fec4e7624d16bdfc',
};
const manifest = json(resolve(revision, 'SOURCE-MANIFEST.json'), pins.manifest);
const acceptance = json(resolve(evidence, 'INDEPENDENT-GRID-ASSOCIATION-SOURCE-ACCEPTANCE.json'), pins.sourceAcceptance);
const admission = json(resolve(evidence, 'RETAINED-FIVE-REPLAY-ADMISSION.json'), pins.inputAdmission);
const preparation = json(resolve(workspace, 'scanner-evaluation-v2-private/PREPARATION-RECEIPT.json'), pins.preparation);
const plan = json(resolve(workspace, 'scanner-evaluation-v2-private/PLAN.json'), pins.plan);
pinned(resolve(evidence, 'REPLAY-RETAINED-DEVELOPMENT-BROWSER.mjs'), pins.driver);
assert.equal(manifest.productionSourceFrozen, true);
assert.equal(manifest.browserRuntimeSourceHashes['app/pocket/image-plot-region.ts'], pins.detector);
assert.equal(manifest.browserRuntimeSourceHashes['app/pocket/image-axis-verification.ts'], pins.helper);
assert.equal(acceptance.candidateSourcePins['app/pocket/image-plot-region.ts'], pins.detector);
assert.equal(plan.protocolSha256, pins.protocol);
assert.equal(plan.objectiveReferenceSha256, pins.reference);
assert.equal(preparation.planSha256, pins.plan);

// Execute only the unchanged pure metadata collector/parser to enumerate hints.
// All reference coordinates below are calculated independently from calibration.
pinned(resolve(app, 'app/pocket/source-price-candidates.ts'), pins.collector);
pinned(resolve(app, 'app/pocket/axis-verification.ts'), pins.parser);
const { collectSourcePriceCandidates } = await import(pathToFileURL(resolve(app, 'app/pocket/source-price-candidates.ts')));
const { exactAxisPrice } = await import(pathToFileURL(resolve(app, 'app/pocket/axis-verification.ts')));

function mainObject(response) {
  assert.equal(response.status, 'completed');
  assert.equal(response.error, null);
  assert.equal(response.incomplete_details, null);
  const text = response.output.filter(item => item.type === 'message')
    .flatMap(item => item.content).filter(item => item.type === 'output_text')
    .map(item => item.text).join('');
  if (typeof response.output_text === 'string') assert.equal(response.output_text, text);
  const value = JSON.parse(text);
  need(value && typeof value === 'object' && !Array.isArray(value), 'MAIN is not an object');
  return value;
}
// Arithmetic reproduction of the frozen helper's least-squares row for loss
// attribution only. This does not generate accepted output or reference rows.
function recordedFit(anchors, height) {
  const meanPrice = anchors.reduce((sum, a) => sum + a.price, 0) / anchors.length;
  const meanY = anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length;
  const variance = anchors.reduce((sum, a) => sum + (a.price - meanPrice) ** 2, 0);
  const slope = anchors.reduce((sum, a) => sum + (a.price - meanPrice) * (a.y - meanY), 0) / variance;
  need(Number.isFinite(slope) && slope < 0, 'Invalid recorded fit');
  return price => (meanY + (price - meanPrice) * slope) * height / 100;
}
const cases = [];
for (const [sourceCaseId, observationSha256] of Object.entries(observations)) {
  const filename = sourceCaseId.toUpperCase() + '-RETAINED-BROWSER-OBSERVATION.json';
  const observed = json(resolve(revision, filename), observationSha256);
  assert.equal(observed.status, 'RECORDED');
  assert.equal(observed.driverSha256, pins.driver);
  assert.deepEqual(observed.sourceHashes, manifest.browserRuntimeSourceHashes);
  assert.deepEqual(observed.errors, []);
  assert.deepEqual(observed.blockedExternalRequests, []);
  assert.equal(observed.providerCalls, 0);
  assert.equal(observed.databaseCalls, 0);
  const old = admission.cases.find(c => c.sourceCaseId === sourceCaseId);
  const mainPath = sourceCaseId === 'd001'
    ? resolve(workspace, 'private-six/results/v2-run40095819408/decrypted/provider-response-main.json')
    : resolve(workspace, relative('/workspace/scratch/616faf3e8649', old.completedMain.path));
  const mainSha = sourceCaseId === 'd001'
    ? '6a271af7026e5b6c6447437d32ce4c67a262965a1df9c962439d892575468f06' : old.completedMain.sha256;
  const main = mainObject(json(mainPath, mainSha));
  assert.equal(observed.mainResponseSha256, mainSha);
  const candidate = collectSourcePriceCandidates(main);
  assert.equal(observed.result.candidateCount, candidate.levels.length);
  const diagPath = sourceCaseId === 'd001'
    ? resolve(workspace, 'private-six/results/v2-run40095819408/decrypted/diagnostic-output-final.json')
    : resolve(workspace, relative('/workspace/scratch/616faf3e8649', old.bindings.diagnosticPath));
  const diagSha = sourceCaseId === 'd001'
    ? '4db39e031c3ed48b09f9a49e3b1cd79039b32922eec109709d076bbf17464250' : old.bindings.diagnosticSha256;
  const diagnostic = json(diagPath, diagSha), original = diagnostic.diagnostics.rawMain;
  assert.equal(diagnostic.rawSha256.main, mainSha);
  assert.equal(original.caseId, sourceCaseId);
  assert.equal(original.tolerance.originalPixels, tolerance);
  assert.equal(original.protocolSha256, pins.protocol);
  assert.equal(original.sourceReferenceSha256, pins.reference);
  assert.equal(original.identities.calibrationSha256, calibrationPins[sourceCaseId]);
  assert.equal(original.identities.imageSha256, observed.imageSha256);
  if (old) {
    assert.equal(observed.imageSha256, old.image.sha256);
    assert.equal(old.inputAvailability, 'RETAINED_BINDINGS_VERIFIED');
    assert.equal(old.bindings.responseMatchesRetentionManifest, true);
  }
  const prepared = preparation.bundles.find(b => b.sourceCaseId === sourceCaseId);
  const planned = plan.cases.find(c => c.sourceCaseId === sourceCaseId);
  assert.equal(prepared.caseId, 'v2-' + sourceCaseId);
  assert.equal(planned.caseId, prepared.caseId);
  const bundlePath = resolve(workspace, 'scanner-evaluation-v2-private', prepared.path);
  const compressed = pinned(bundlePath, prepared.sha256);
  assert.equal(compressed.length, prepared.bytes);
  const bundle = JSON.parse(gunzipSync(compressed));
  assert.equal(bundle.caseId, prepared.caseId);
  assert.equal(bundle.sourceCaseId, sourceCaseId);
  assert.equal(bundle.planSha256, pins.plan);
  const entry = bundle.entries.filter(e => e.path === 'artifacts/calibration');
  assert.equal(entry.length, 1);
  assert.equal(entry[0].sha256, calibrationPins[sourceCaseId]);
  assert.equal(planned.artifacts.calibration, entry[0].sha256);
  const imageEntries = bundle.entries.filter(e => e.path === 'artifacts/image');
  assert.equal(imageEntries.length, 1);
  assert.equal(imageEntries[0].sha256, observed.imageSha256);
  assert.equal(planned.artifacts.image, observed.imageSha256);
  // Sole base64 payload access: one calibration entry per authorized case.
  const calibrationBytes = Buffer.from(entry[0].data, 'base64');
  assert.equal(hash(calibrationBytes), entry[0].sha256);
  const c = JSON.parse(calibrationBytes);
  assert.equal(c.kind, 'linear');
  assert.deepEqual(observed.result.dimensions, [c.width, c.height]);
  assert.equal(c.cropMapping.kind, 'identity');
  assert.deepEqual(c.cropMapping.originalSize, [c.width, c.height]);
  assert.equal(c.cropMapping.precisionRect, null);
  const priceToY = price => {
    const value = Number(price);
    need(Number.isFinite(value) && value >= Number(c.priceMin) && value <= Number(c.priceMax), 'Reference price outside calibration');
    const exact = c.ticks.filter(t => Number(t.price) === value);
    need(exact.length <= 1, 'Ambiguous exact reference tick');
    return { y: exact.length ? exact[0].y :
      c.plot.top + (Number(c.priceMax) - value) / (Number(c.priceMax) - Number(c.priceMin)) * (c.plot.bottom - c.plot.top),
      method: exact.length ? 'EXACT_REFERENCE_TICK' : 'LINEAR_REFERENCE_INTERPOLATION' };
  };
  const r = observed.result, region = r.imageRecovery.region, axis = r.imageRecovery.axis;
  assert.equal(region.status, 'measured');
  assert.equal(axis.status, 'verified');
  assert.equal(axis.policy, 'image-axis-v1');
  assert.deepEqual([region.width, region.height], [c.width, c.height]);
  assert.deepEqual(axis.modelPriceEvidence, candidate.axisPrices);
  need(axis.anchors.length >= 3, 'Empty/insufficient axis cannot pass');
  need(r.placement.levels.length > 0, 'Empty placement is UNMEASURED, not an accuracy pass');
  assert.equal(r.placement.reason, null);
  const plotEdges = ['left', 'right', 'top', 'bottom'].map(edge => ({
    edge, measuredPixels: region.plotPixels[edge], referencePixels: c.plot[edge],
    absoluteErrorPixels: Math.abs(region.plotPixels[edge] - c.plot[edge]),
  }));
  const anchors = axis.anchors.map(a => {
    const reference = priceToY(a.price), row = a.y * c.height / 100;
    const association = region.axisLabelRegionPixels.matchedGridRows.filter(y => y / c.height * 100 === a.y);
    assert.equal(association.length, 1, 'Anchor is not uniquely bound to an observed grid row');
    const words = axis.wordEvidence.filter(w => exactAxisPrice(w.text) === a.price && w.confidence >= 80 &&
      Math.abs(w.y - association[0]) <= Math.max(3, w.height * .35));
    need(words.length > 0, 'No confident original OCR reading supports anchor');
    return { price: a.price, measuredGridPixels: association[0], percentRoundTripPixels: row,
      referencePixels: reference.y, referenceMethod: reference.method,
      absoluteErrorPixels: Math.abs(row - reference.y), supportingOcrReadings: words.length,
      minimumSupportingConfidence: Math.min(...words.map(w => w.confidence)),
      maximumGlyphCentreToGridPixels: max(words.map(w => Math.abs(w.y - association[0]))) };
  });
  function endpoints(price, actual) {
    const reference = priceToY(price);
    const expected = { x1: c.plot.left, x2: c.plot.right, y1: reference.y, y2: reference.y };
    const error = Object.fromEntries(Object.keys(expected).map(key => [key, Math.abs(actual[key] - expected[key])]));
    return { actualPixels: actual, referencePixels: expected, referenceMethod: reference.method,
      absoluteErrorsPixels: error, maxCoordinateErrorPixels: max(Object.values(error)),
      maxEndpointDistancePixels: Math.max(Math.hypot(error.x1, error.y1), Math.hypot(error.x2, error.y2)),
      rowErrorPixels: Math.max(error.y1, error.y2) };
  }
  const projected = r.placement.levels.map((level, index) => {
    need(candidate.levels.some(h => h.kind === level.kind && h.price === level.price), 'Placed price absent from raw MAIN hints');
    assert.equal(level.source, 'PRIMARY'); assert.equal(level.placement, 'IMAGE_AXIS'); assert.equal(level.provenance, 'UNVERIFIED');
    return { index, price: level.price, kind: level.kind, semanticProvenance: 'UNVERIFIED',
      ...endpoints(level.price, { x1: level.x * c.width / 100, x2: level.x2 * c.width / 100,
        y1: level.y * c.height / 100, y2: level.y2 * c.height / 100 }) };
  });
  const sections = r.rendered.filter(section => section.header === 'ORIGINAL CHART LEVELS');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].lines.length, projected.length);
  assert.equal(sections[0].polylines, 0); assert.equal(sections[0].rectangles, 0);
  const rendered = sections[0].lines.map((line, index) => {
    const scored = endpoints(projected[index].price, line);
    const placementDelta = max(Object.keys(line).map(key => Math.abs(line[key] - projected[index].actualPixels[key])));
    need(placementDelta <= 1e-9, 'Rendered SVG does not correspond to projected candidate');
    return { index, price: projected[index].price, ...scored, maxPlacementDeltaPixels: placementDelta };
  });
  for (const section of r.rendered.filter(s => s.header !== 'ORIGINAL CHART LEVELS')) {
    assert.equal(section.lines.length, 0); assert.equal(section.polylines, 0); assert.equal(section.rectangles, 0);
  }
  const fittedPixels = recordedFit(axis.anchors, c.height);
  const minimum = Math.min(...axis.anchors.map(a => a.price)), maximum = Math.max(...axis.anchors.map(a => a.price));
  const omitted = candidate.levels.filter(h => !r.placement.levels.some(p => h.kind === p.kind && h.price === p.price)).map(h => {
    const value = exactAxisPrice(h.price), fitRow = fittedPixels(value);
    const exact = axis.anchors.filter(a => a.price === value);
    const withinDomain = value >= minimum && value <= maximum;
    const originalRows = exact.flatMap(a => region.axisLabelRegionPixels.matchedGridRows.filter(y => y / c.height * 100 === a.y));
    const outside = fitRow < region.plotPixels.top || fitRow > region.plotPixels.bottom;
    need(!withinDomain || outside, 'Omission is not explained by frozen helper guards');
    return { kind: h.kind, price: h.price, numericValue: value, withinIndependentlyReadPriceDomain: withinDomain,
      exactVerifiedOcrAnchor: exact.length === 1, originalMatchedGridRowPixels: originalRows.length === 1 ? originalRows[0] : null,
      fittedRowPixels: fitRow, plotTopPixels: region.plotPixels.top, plotBottomPixels: region.plotPixels.bottom,
      pixelsAbovePlot: Math.max(0, region.plotPixels.top - fitRow), pixelsBelowPlot: Math.max(0, fitRow - region.plotPixels.bottom),
      reason: withinDomain ? 'GLOBAL_LINEAR_FIT_OUTSIDE_PLOT_DESPITE_EXACT_BOUNDARY_ANCHOR' : 'OUTSIDE_VERIFIED_PRICE_DOMAIN',
      sourceGuard: 'imagePixelPriceCandidates: reject rowPixels < p.top or rowPixels > p.bottom after numeric domain check',
      rendered: false, geometryAccuracy: 'UNMEASURED_OMITTED', semanticAccuracy: 'UNSCORED' };
  });
  const summary = {
    candidateHints: candidate.levels.length, placedCandidates: projected.length, omittedCandidates: omitted.length,
    plotEdges: plotEdges.length, maxPlotEdgeErrorPixels: max(plotEdges.map(x => x.absoluteErrorPixels)),
    ocrGridAnchors: anchors.length, maxAnchorRowErrorPixels: max(anchors.map(x => x.absoluteErrorPixels)),
    maxProjectedRowErrorPixels: max(projected.map(x => x.rowErrorPixels)),
    maxProjectedEndpointErrorPixels: max(projected.map(x => x.maxEndpointDistancePixels)),
    renderedLines: rendered.length, maxRenderedRowErrorPixels: max(rendered.map(x => x.rowErrorPixels)),
    maxRenderedEndpointErrorPixels: max(rendered.map(x => x.maxEndpointDistancePixels)),
    maxRenderedPlacementDeltaPixels: max(rendered.map(x => x.maxPlacementDeltaPixels)),
    emittedGeometryWithinOnePixel: [...plotEdges, ...anchors].every(x => x.absoluteErrorPixels <= tolerance) &&
      [...projected, ...rendered].every(x => x.maxEndpointDistancePixels <= tolerance),
    allEligibleCandidatesPlaced: omitted.length === 0, semanticAccuracy: 'UNSCORED',
  };
  cases.push({
    sourceCaseId, status: summary.emittedGeometryWithinOnePixel ? 'PASS_EMITTED_GEOMETRY_ONLY' : 'FAIL_EMITTED_GEOMETRY',
    inputs: { observationPath: relativePath(resolve(revision, filename)), observationSha256,
      imageSha256: observed.imageSha256, mainResponsePath: relativePath(mainPath), mainResponseSha256: mainSha,
      diagnosticPath: relativePath(diagPath), diagnosticSha256: diagSha,
      bundlePath: relativePath(bundlePath), bundleSha256: prepared.sha256,
      calibrationEntry: 'artifacts/calibration', calibrationSha256: entry[0].sha256,
      dimensions: [c.width, c.height], cropMapping: c.cropMapping },
    bindingChecks: { recordedSourceMatchesFrozenManifest: true, sourceAcceptanceMatchesDetector: true,
      mainCompletedAndByteHashVerified: true, mainMatchesIndependentDiagnostic: true,
      imageMatchesObservationPlanBundleAndDiagnostic: true, calibrationMatchesPlanBundleAndDiagnostic: true,
      originalReferenceAndProtocolUnchanged: true, onlyCalibrationEntryDecoded: true },
    legacy: { axis: r.legacyAxis, pixelsNull: r.pixelsNull, calibratedScaleReadable: r.calibratedScaleReadable },
    plotEdges, anchors, projectedCandidates: projected, renderedSvgLines: rendered, omittedCandidates: omitted,
    candidateInput: { levelInput: candidate.levelInput, axisInput: candidate.axisInput,
      rejectedLevels: candidate.rejectedLevels, rejectedAxisPrices: candidate.rejectedAxisPrices },
    summary,
  });
}
const total = key => cases.reduce((sum, c) => sum + c.summary[key], 0);
const worst = key => max(cases.map(c => c.summary[key]));
const scriptSha = hash(readFileSync(fileURLToPath(import.meta.url)));
const report = {
  kind: 'GRID_ASSOCIATION_REVISION_INDEPENDENT_ONE_PIXEL_REVIEW',
  reviewedAtUtc: new Date().toISOString(), reviewer: 'precision_contract_fix',
  status: cases.every(c => c.summary.emittedGeometryWithinOnePixel)
    ? 'PASS_EMITTED_GEOMETRY_WITH_TWO_BOUNDARY_CANDIDATE_OMISSIONS' : 'FAIL_EMITTED_GEOMETRY',
  sourceIdentity: { manifestSha256: pins.manifest, sourceAcceptanceSha256: pins.sourceAcceptance,
    historicalCommit: manifest.historicalSourceCommit, candidateParentCommit: manifest.parentCommit,
    detectorSha256: pins.detector, axisHelperSha256: pins.helper, browserDriverSha256: pins.driver,
    sourceHashes: manifest.browserRuntimeSourceHashes,
    identityMeaning: 'The exact recorded runtime snapshot is bound by the manifest and every observation; later workspace changes are not this scored revision.' },
  method: { toleranceOriginalPixels: tolerance, calibrationLookup: 'Exact numeric tick match, otherwise linear interpolation using unchanged calibration range and plot.',
    percentageConversion: 'x * originalWidth / 100; y * originalHeight / 100.',
    endpointMetric: 'Euclidean error of each endpoint, plus individual coordinate and row errors.',
    ocrMetric: 'Numeric OCR readings associated to independently measured grid rows; glyph centres themselves are not asserted to be grid rows.',
    internalRenderCorrespondenceTolerancePixels: 1e-9,
    oracleToleranceWidened: false, pixelQuantizationAllowanceAdded: false,
    rawHintsEnumeration: 'Pinned unchanged pure collector/parser only; no image or production projection rerun.',
    omittedCandidateReason: 'Independent arithmetic reproduction of the recorded helper least-squares fit and exact containment guard.',
    referenceSha256: pins.reference, protocolSha256: pins.protocol,
    calibrationPassedToBrowser: false },
  inputAdmissions: { retainedFiveSha256: pins.inputAdmission, preparationSha256: pins.preparation, planSha256: pins.plan },
  cases,
  summary: { casesScored: cases.length, candidateHints: total('candidateHints'), placedCandidates: total('placedCandidates'),
    omittedCandidates: total('omittedCandidates'), plotEdges: total('plotEdges'), ocrGridAnchors: total('ocrGridAnchors'),
    renderedLines: total('renderedLines'), maxPlotEdgeErrorPixels: worst('maxPlotEdgeErrorPixels'),
    maxAnchorRowErrorPixels: worst('maxAnchorRowErrorPixels'), maxProjectedEndpointErrorPixels: worst('maxProjectedEndpointErrorPixels'),
    maxRenderedEndpointErrorPixels: worst('maxRenderedEndpointErrorPixels'),
    maxRenderedPlacementDeltaPixels: worst('maxRenderedPlacementDeltaPixels'),
    allEmittedGeometryWithinOnePixel: cases.every(c => c.summary.emittedGeometryWithinOnePixel),
    allEligibleCandidatesPlaced: cases.every(c => c.summary.allEligibleCandidatesPlaced) },
  d005: { disposition: 'HOLD_BEFORE_OCR_UNCHANGED', inputsAvailable: true,
    reason: 'Support/resistance prices explicitly use approximation markers (approximately 776.18 and 773.0); strict exact-price parsing rejects them. The approximate pivot is also an unsupported kind.',
    supportResistanceKindsAbsent: false, exactEligibleCandidates: 0, geometry: 'UNMEASURED',
    semantics: 'UNSCORED', verifiedAbsence: false, calibrationRead: false },
  acceptance: { emittedOriginalPixelGeometry: cases.every(c => c.summary.emittedGeometryWithinOnePixel),
    completeCandidateCoverage: false, semanticTradingAccuracy: false, patterns: false, liquidity: false,
    verifiedAbsence: false, heldOutGeneralization: false, physicalDeviceLatency: false, deployedHttpLatency: false },
  effects: { browserRuns: 0, imageDecodes: 0, detectorCalls: 0, ocrCalls: 0, productionProjectionCalls: 0,
    pureMetadataCollectorCalls: 5, calibrationEntriesDecoded: 5, providerCalls: 0, databaseCalls: 0,
    privateKeyReads: 0, decryptionOperations: 0, heldOutReads: 0, sourceChanges: 0, oracleChanges: 0, networkCalls: 0 },
  reproducibility: { comparatorSha256: scriptSha, node: process.version,
    command: 'node ' + relativePath(fileURLToPath(import.meta.url)) + ' <workspace> <new-output-directory>',
    existingOutputOverwriteAllowed: false },
  limitations: [
    'These are five previously used development images; no held-out or broader scanner accuracy claim follows.',
    'The emitted lines, plot edges and axis rows pass a geometric comparison only; support/resistance meaning remains unverified.',
    'The two omitted exact top-boundary candidates are coverage defects. Their absence receives no geometric pass or verified-absence credit.',
    'Both omitted prices are inside the independently read numeric domain; their global fitted rows fall just outside the measured plot.',
    'd004 legacy pixels are non-null because its existing model-quality gate passed; its legacy axis remains held and its scored horizontal lines use IMAGE_AXIS.',
    'd005 remains held because price text is approximate, not because support/resistance kinds are absent.',
    'All prior failing or held observations remain historical evidence. This comparison does not authorize paid cases or deployment.',
  ],
};
const rows = cases.map(c => {
  const s = c.summary;
  return '| ' + c.sourceCaseId + ' | ' + s.placedCandidates + '/' + s.candidateHints + ' | ' +
    s.maxPlotEdgeErrorPixels.toFixed(6) + ' | ' + s.maxAnchorRowErrorPixels.toFixed(6) + ' | ' +
    s.maxProjectedEndpointErrorPixels.toFixed(6) + ' | ' + s.maxRenderedEndpointErrorPixels.toFixed(6) + ' | ' +
    (s.emittedGeometryWithinOnePixel ? 'PASS emitted geometry' : 'FAIL') + ' |';
});
const md = [
  '# Independent one-pixel review: grid-association revision', '',
  'All five completed browser receipts are bound to the frozen detector and axis-helper snapshot. The unchanged threshold is one original pixel. The review scores emitted geometry and preserves omitted candidates separately.', '',
  '| Case | Placed / exact hints | Max plot-edge error px | Max OCR/grid error px | Max projected-endpoint error px | Max rendered-endpoint error px | Result |',
  '|---|---:|---:|---:|---:|---:|---|', ...rows, '',
  '## Coverage defects', '',
  ...cases.flatMap(c => c.omittedCandidates.map(o => '- ' + c.sourceCaseId + ': ' + o.kind + ' price ' + o.price +
    ' is an exact OCR anchor at ' + o.originalMatchedGridRowPixels + ' px and inside the verified numeric domain. The global fit yields ' +
    o.fittedRowPixels + ' px, ' + o.pixelsAbovePlot + ' px above the plot. The frozen containment guard drops it.')),
  '', 'The 11 rendered candidates out of 13 exact hints do not establish complete recall. No omitted row is credited as accurate or as verified absence.', '',
  '## Scope', '',
  'Semantics, trading interpretation, pattern/liquidity accuracy, held-out performance, physical-device latency and deployed HTTP latency remain unaccepted. d005 remains HOLD because the support/resistance price strings are approximate; those kinds are present. No approximation marker was stripped.', '',
  'The comparator reads only the five authorized calibration entries after browser execution. It independently calculates reference coordinates, checks input/source hashes, and verifies actual SVG endpoints against both the projections and reference. No browser, detector, OCR, provider, database or key operation runs.', '',
  'Detector SHA256: ' + pins.detector, '',
  'Axis helper SHA256: ' + pins.helper, '',
  'Source manifest SHA256: ' + pins.manifest, '',
  'Comparator SHA256: ' + scriptSha, '',
].join('\n');
mkdirSync(output, { recursive: true });
const jsonBytes = Buffer.from(JSON.stringify(report, null, 2) + '\n'), mdBytes = Buffer.from(md);
writeFileSync(resolve(output, 'INDEPENDENT-ONE-PIXEL-REVIEW.json'), jsonBytes, { flag: 'wx', mode: 0o600 });
writeFileSync(resolve(output, 'INDEPENDENT-ONE-PIXEL-REVIEW.md'), mdBytes, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: report.status, summary: report.summary, cases: cases.map(c => ({ sourceCaseId: c.sourceCaseId, ...c.summary })),
  output: relativePath(output), jsonSha256: hash(jsonBytes), markdownSha256: hash(mdBytes), comparatorSha256: scriptSha }, null, 2));
