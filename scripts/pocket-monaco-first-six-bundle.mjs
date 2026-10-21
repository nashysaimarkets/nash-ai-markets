/** First-six data transport only. Reads existing, hash-pinned files; never
 * regenerates charts/requests or opens held-out files. Gzip reduces repeated
 * image/base64 bytes before encryption. Decoded files are data in a new private
 * temporary directory, never source code or an existing checkout/mount.
 */
import {createHash} from 'node:crypto';
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {gzipSync, gunzipSync} from 'node:zlib';
import {PINS} from './pocket-monaco-setup-preflight.mjs';

const IDS = Object.freeze(['d001','d002','d003','d004','d005','d006']);
const SLOTS = ['main','primary_precision','rescue_precision'];
const MANIFEST = 'packet/BENCHMARK50.json';
const REQUESTS = 'packet/request-previews/REQUEST-PREVIEWS.json';
const REFERENCE = 'objective-reference.json', PROTOCOL = 'protocol.json';
const MAX_BYTES = 128 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const requireValue = ok => { if (!ok) throw Error('FIRST_SIX_BUNDLE_REFUSED'); };
const validPath = path => typeof path === 'string' && path.length <= 512 && !isAbsolute(path)
  && !/[\\\0]/.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..');
const parse = bytes => JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));

/** Pure inventory selection, also usable with synthetic fixtures. Production
 * build verifies both frozen inventory hashes before this function is called.
 */
export function firstSixBundleInventory(manifest, requests) {
  const selected = new Map();
  const add = (path, sha256) => {
    requireValue(validPath(path) && digest(sha256));
    const name = `packet/${path}`;
    requireValue(!selected.has(name) || selected.get(name) === sha256);
    selected.set(name, sha256);
  };
  requireValue(Array.isArray(manifest?.cases) && Array.isArray(requests?.calls));
  for (const caseId of IDS) {
    const matches = manifest.cases.filter(row => row.caseId === caseId);
    requireValue(matches.length === 1); const c = matches[0];
    for (const [pathKey, hashKey] of [['inputPath','inputSha256'],['imagePath','rasterSha256'],
      ['barsPath','barsSha256'],['sourcePath','sourceZipSha256'],['licencePath','licenceSha256'],
      ['calibrationPath','calibrationSha256']]) add(c[pathKey], c[hashKey]);
    for (const slot of SLOTS) {
      const rows = requests.calls.filter(row => row.caseId === caseId && row.slot === slot);
      requireValue(rows.length === 1 && rows[0].inputSha256 === c.inputSha256);
      add(`request-previews/${rows[0].path}`, rows[0].envelopeFileSha256);
    }
  }
  return [...selected].map(([path,sha256]) => ({path,sha256}));
}

/** Pure encoding; no admission is implied. Only the production builder below
 * binds these bytes to the frozen plan; bootstrap repeats the original checks.
 */
export function packFirstSixBundle(files) {
  requireValue(Array.isArray(files) && files.length > 0 && files.length <= 64);
  const seen = new Set(); let total = 0;
  const entries = files.map(({path,bytes}) => {
    requireValue(validPath(path) && (path.startsWith('packet/') || [REFERENCE,PROTOCOL].includes(path))
      && !seen.has(path) && bytes instanceof Uint8Array);
    seen.add(path); total += bytes.length; requireValue(total <= MAX_BYTES / 2);
    return {path,sha256:hash(bytes),data:Buffer.from(bytes).toString('base64')};
  }).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  requireValue([MANIFEST,REQUESTS,REFERENCE,PROTOCOL].every(path => seen.has(path)));
  const bytes = gzipSync(Buffer.from(JSON.stringify({kind:'MONACO_FIRST_SIX_BUNDLE_V1',caseIds:IDS,entries})), {level:6});
  return {bytes,sha256:hash(bytes),fileCount:entries.length};
}

export function buildFirstSixBundle({packetDirectory,objectiveReferencePath,protocolPath}) {
  try {
    const planBytes = readFileSync(new URL('../docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json', import.meta.url));
    requireValue(hash(planBytes) === PINS.planSha256); const plan = parse(planBytes);
    const root = realpathSync(packetDirectory);
    const readPacket = (path, expected) => {
      requireValue(validPath(path)); const actual = realpathSync(resolve(root,path)), rel = relative(root,actual);
      requireValue(rel && !rel.startsWith('..') && !isAbsolute(rel));
      const bytes = readFileSync(actual); requireValue(hash(bytes) === expected); return bytes;
    };
    const manifest = readPacket('BENCHMARK50.json', plan.manifestSha256);
    const requests = readPacket('request-previews/REQUEST-PREVIEWS.json', plan.requestInventorySha256);
    const files = [{path:MANIFEST,bytes:manifest},{path:REQUESTS,bytes:requests}];
    for (const file of firstSixBundleInventory(parse(manifest),parse(requests))) {
      files.push({path:file.path,bytes:readPacket(file.path.slice('packet/'.length),file.sha256)});
    }
    for (const [path,source,expected] of [[REFERENCE,objectiveReferencePath,plan.objectiveReferenceSha256],
      [PROTOCOL,protocolPath,plan.protocolSha256]]) {
      const bytes = readFileSync(source); requireValue(hash(bytes) === expected); files.push({path,bytes});
    }
    return packFirstSixBundle(files);
  } catch { throw Error('FIRST_SIX_BUNDLE_REFUSED'); }
}

export function unpackFirstSixBundle({bytes,expectedBundleSha256}) {
  let directory;
  try {
    requireValue(bytes instanceof Uint8Array && bytes.length <= MAX_BYTES / 2
      && digest(expectedBundleSha256) && hash(bytes) === expectedBundleSha256);
    const bundle = parse(gunzipSync(bytes, {maxOutputLength:MAX_BYTES}));
    requireValue(bundle?.kind === 'MONACO_FIRST_SIX_BUNDLE_V1'
      && JSON.stringify(bundle.caseIds) === JSON.stringify(IDS)
      && Array.isArray(bundle.entries) && bundle.entries.length <= 64);
    const files = new Map(); let total = 0;
    for (const entry of bundle.entries) {
      requireValue(validPath(entry?.path) && !files.has(entry.path)
        && (entry.path.startsWith('packet/') || [REFERENCE,PROTOCOL].includes(entry.path))
        && digest(entry.sha256) && typeof entry.data === 'string' && entry.data.length <= MAX_BYTES);
      const content = Buffer.from(entry.data,'base64'); total += content.length;
      requireValue(total <= MAX_BYTES / 2 && content.toString('base64') === entry.data && hash(content) === entry.sha256);
      files.set(entry.path,content);
    }
    requireValue([MANIFEST,REQUESTS,REFERENCE,PROTOCOL].every(path => files.has(path)));
    const inventory = firstSixBundleInventory(parse(files.get(MANIFEST)),parse(files.get(REQUESTS)));
    const expectedPaths = new Set([MANIFEST,REQUESTS,REFERENCE,PROTOCOL,...inventory.map(file => file.path)]);
    requireValue(expectedPaths.size === files.size && [...files.keys()].every(path => expectedPaths.has(path)));
    for (const file of inventory) requireValue(hash(files.get(file.path)) === file.sha256);
    directory = mkdtempSync(join(tmpdir(),'monaco-first-six-input-')); chmodSync(directory,0o700);
    for (const [path,content] of files) {
      const target = join(directory,path); mkdirSync(dirname(target),{recursive:true,mode:0o700});
      writeFileSync(target,content,{flag:'wx',mode:0o600});
    }
    return Object.freeze({directory,inputPaths:Object.freeze({packetDirectory:join(directory,'packet'),
      objectiveReferencePath:join(directory,REFERENCE),protocolPath:join(directory,PROTOCOL)}),
    cleanup() { rmSync(directory,{recursive:true,force:true}); }});
  } catch {
    if (directory) { try { rmSync(directory,{recursive:true,force:true}); } catch { /* Private temporary files only. */ } }
    throw Error('FIRST_SIX_BUNDLE_REFUSED');
  }
}
