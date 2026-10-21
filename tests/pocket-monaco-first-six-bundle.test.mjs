import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync, gzipSync} from 'node:zlib';
import {firstSixBundleInventory, packFirstSixBundle, unpackFirstSixBundle}
  from '../scripts/pocket-monaco-first-six-bundle.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function fixture() {
  const manifest = {cases:[]}, requests = {calls:[]}, files = [];
  for (let i=1;i<=6;i++) {
    const caseId = `d00${i}`, row = {caseId};
    for (const [pathKey,hashKey,name] of [['inputPath','inputSha256','input.json'],
      ['imagePath','rasterSha256','image.png'],['barsPath','barsSha256','bars.json'],
      ['sourcePath','sourceZipSha256','source.zip'],['licencePath','licenceSha256','licence.txt'],
      ['calibrationPath','calibrationSha256','calibration.json']]) {
      const bytes = Buffer.from(`synthetic ${caseId} ${name}`), path = `cases/${caseId}/${name}`;
      row[pathKey] = path; row[hashKey] = hash(bytes); files.push({path:`packet/${path}`,bytes});
    }
    manifest.cases.push(row);
    for (const slot of ['main','primary_precision','rescue_precision']) {
      const path = `${caseId}-${slot}.json`, bytes = Buffer.from(`synthetic ${caseId} ${slot}`);
      requests.calls.push({caseId,slot,path,inputSha256:row.inputSha256,envelopeFileSha256:hash(bytes)});
      files.push({path:`packet/request-previews/${path}`,bytes});
    }
  }
  // Held-out metadata is present in the unchanged inventories, but no payload
  // for it exists. Selecting the first six must not ask for that payload.
  manifest.cases.push({caseId:'e001',inputPath:'held-out/e001-must-not-read.json'});
  requests.calls.push({caseId:'e001',slot:'main',path:'held-out/e001-must-not-read.json'});
  files.push({path:'packet/BENCHMARK50.json',bytes:Buffer.from(JSON.stringify(manifest))},
    {path:'packet/request-previews/REQUEST-PREVIEWS.json',bytes:Buffer.from(JSON.stringify(requests))},
    {path:'objective-reference.json',bytes:Buffer.from('synthetic reference')},
    {path:'protocol.json',bytes:Buffer.from('synthetic protocol')});
  return {manifest,requests,files};
}

test('inventory selects only first-six source/request files, including required source and licence bytes', () => {
  const f = fixture(), selected = firstSixBundleInventory(f.manifest,f.requests);
  assert.equal(selected.length,54);
  assert.equal(selected.some(row => /e001|held-out/.test(row.path)),false);
  assert.equal(selected.filter(row => row.path.endsWith('source.zip')).length,6);
  assert.equal(selected.filter(row => row.path.endsWith('licence.txt')).length,6);
  f.manifest.cases.push(f.manifest.cases[0]); assert.throws(() => firstSixBundleInventory(f.manifest,f.requests));
});

test('compressed private bundle round-trips unchanged bytes into a new owner-only directory', t => {
  const f = fixture(), packed = packFirstSixBundle(f.files);
  assert.deepEqual(packFirstSixBundle([...f.files].reverse()).bytes,packed.bytes);
  const extracted = unpackFirstSixBundle({bytes:packed.bytes,expectedBundleSha256:packed.sha256});
  t.after(() => extracted.cleanup());
  assert.equal(lstatSync(extracted.directory).mode & 0o777,0o700);
  for (const file of f.files) {
    const path = join(extracted.directory,file.path);
    assert.deepEqual(readFileSync(path),file.bytes); assert.equal(lstatSync(path).mode & 0o777,0o600);
  }
  assert.equal(extracted.inputPaths.packetDirectory,join(extracted.directory,'packet'));
  assert.equal(existsSync(join(extracted.directory,'packet/held-out')),false);
  extracted.cleanup(); assert.equal(existsSync(extracted.directory),false);
});

test('wrong bundle pin, traversal, duplicate, extra held-out and missing files are refused', () => {
  const f = fixture(), packed = packFirstSixBundle(f.files);
  assert.throws(() => unpackFirstSixBundle({bytes:packed.bytes,expectedBundleSha256:'0'.repeat(64)}));
  for (const mutate of [
    bundle => { bundle.entries[0].path = '../escape'; },
    bundle => { bundle.entries[0].path = 'packet/../../escape'; },
    bundle => { bundle.entries.push(bundle.entries[0]); },
    bundle => { bundle.entries.push({path:'packet/held-out/e001.json',sha256:hash('extra'),data:Buffer.from('extra').toString('base64')}); },
    bundle => { bundle.entries = bundle.entries.filter(row => !row.path.endsWith('d001/input.json')); },
    bundle => { bundle.entries[0].data = Buffer.from('changed').toString('base64'); },
    bundle => { bundle.caseIds.push('e001'); },
  ]) {
    const bundle = JSON.parse(gunzipSync(packed.bytes)); mutate(bundle);
    const bytes = gzipSync(Buffer.from(JSON.stringify(bundle)));
    assert.throws(() => unpackFirstSixBundle({bytes,expectedBundleSha256:hash(bytes)}),/FIRST_SIX_BUNDLE_REFUSED/);
  }
});

test('inventory refuses ambiguous request slots, source path escapes and input/hash disagreement', () => {
  for (const mutate of [
    f => f.requests.calls.push(f.requests.calls[0]),
    f => { f.requests.calls[0].inputSha256 = '0'.repeat(64); },
    f => { f.manifest.cases[0].sourcePath = '../escape.zip'; },
    f => { f.requests.calls[0].path = '../../escape.json'; },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => firstSixBundleInventory(f.manifest,f.requests),/FIRST_SIX_BUNDLE_REFUSED/);
  }
});
