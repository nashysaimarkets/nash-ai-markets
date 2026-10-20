import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const adapter = new URL('../scripts/run-pocket-metadata-ci.py', import.meta.url);
const source = readFileSync(adapter, 'utf8');

test('CI adapter isolates credentials and runs only the fixed metadata verifier', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monaco-ci-adapter-'));
  try {
    writeFileSync(join(dir, 'adapter.py'), source);
    // Synthetic executable checks the adapter contract without Node, a key,
    // provider requests, or changing the real pinned plan.
    writeFileSync(join(dir, 'node'), `#!/usr/bin/env python3
import os, sys
assert len(sys.argv) == 3
assert sys.argv[1].endswith('/verify-pocket-temporary-key.mjs')
assert not any(k in os.environ for k in ['OPENAI_API_KEY','OPENAI_ADMIN_KEY','NODE_OPTIONS','OPENAI_BASE_URL','MONACO_BENCHMARK_OPENAI_API_KEY'])
if sys.argv[2] == '--preflight':
    assert 'OPENAI_METADATA_VERIFICATION_KEY' not in os.environ
elif sys.argv[2] == '--metadata-only':
    assert os.environ['OPENAI_METADATA_VERIFICATION_KEY'] == 'SYNTHETIC_NONCREDENTIAL'
else:
    raise AssertionError('wrong operation')
`, { mode: 0o700 });
    const result = spawnSync('python3', ['-I', join(dir, 'adapter.py'), '--metadata-only'], {
      encoding: 'utf8', env: { PATH: dir + ':' + process.env.PATH,
        MONACO_BENCHMARK_OPENAI_API_KEY: 'SYNTHETIC_NONCREDENTIAL',
        OPENAI_API_KEY: 'SYNTHETIC_OLD', OPENAI_ADMIN_KEY: 'SYNTHETIC_ADMIN',
        NODE_OPTIONS: '--invalid-synthetic-option', OPENAI_BASE_URL: 'https://invalid.invalid' }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CI adapter rejects unsupported operations without reading a key', () => {
  const result = spawnSync('python3', ['-I', adapter.pathname, '--paid'], { encoding: 'utf8' });
  assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});

test('protected workflow grants credentials only to one metadata step', () => {
  const workflow = readFileSync(new URL('../.github/workflows/monaco-protected-metadata.yml', import.meta.url), 'utf8');
  assert.match(workflow, /environment: monaco-benchmark-metadata/);
  assert.match(workflow, /ref: \$\{\{ github.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.equal((workflow.match(/secrets\./g) || []).length, 1);
  assert.match(workflow, /secrets.MONACO_BENCHMARK_OPENAI_API_KEY/);
  assert.ok(!/pull_request_target|workflow_call|workflow_dispatch|upload-artifact|npm |OPENAI_ADMIN_KEY|secrets.OPENAI_API_KEY/.test(workflow));
  assert.match(workflow, /permissions:\s+contents: read/);
});
