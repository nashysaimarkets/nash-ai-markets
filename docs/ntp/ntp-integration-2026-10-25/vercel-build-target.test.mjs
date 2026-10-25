import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
// Exact command accepted in run40177167084; this test never executes a build or deployment.
const acceptedCommand = 'node node_modules/next/dist/bin/next build --webpack';
const baselineBlob = '92533d4f6c1ddc56fa8808c3b493a4237b9a24d0';
const blobHash = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

function assertNextTarget(value) {
  assert.equal(value.framework, 'nextjs');
  assert.equal(value.buildCommand, acceptedCommand);
  assert.equal(value.outputDirectory, '.next');
}

test('Vercel explicitly selects the accepted Next/webpack build and output', () => {
  assertNextTarget(config);
});

test('all earlier branch holds and unrelated configuration remain byte-equivalent', () => {
  const {framework, buildCommand, outputDirectory, ...unchanged} = config;
  assert.equal(blobHash(JSON.stringify(unchanged, null, 2) + '\n'), baselineBlob);
  assert.equal(unchanged.git.deploymentEnabled['monaco-ntp-integration-20261025-ad6'], false);
});

test('default Worker build cannot silently replace the Vercel build', () => {
  assert.throws(() => assertNextTarget({...config, framework:'nextjs', outputDirectory:'.next', buildCommand:'npm run build'}));
});

test('a missing build override is rejected', () => {
  const value = {...config, framework:'nextjs', outputDirectory:'.next'};
  delete value.buildCommand;
  assert.throws(() => assertNextTarget(value));
});

test('Worker output or static export cannot masquerade as Next server output', () => {
  for (const outputDirectory of ['dist', 'dist/server', 'out', 'public']) {
    assert.throws(() => assertNextTarget({...config, framework:'nextjs', buildCommand:acceptedCommand, outputDirectory}));
  }
});

test('wrong framework cannot silently use the accepted Next command', () => {
  assert.throws(() => assertNextTarget({...config, framework:'vite', buildCommand:acceptedCommand, outputDirectory:'.next'}));
});

test('build command contains no deployment, runtime activation or synthetic test environment', () => {
  assert.equal(config.buildCommand, acceptedCommand);
  assert.doesNotMatch(config.buildCommand, /(?:deploy|promote|wrangler|SITES_|SUPABASE_|OPENAI_|MOCK|POCKET_)/i);
});
