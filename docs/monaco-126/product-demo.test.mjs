import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

// Static safety and authored-copy guards only. These are NOT browser, scanner,
// model-accuracy, native or production acceptance. Supported browser QA is separate.
const directory = dirname(fileURLToPath(import.meta.url));
// Root packages the reviewed authored example as an unpublished candidate asset.
const source = await readFile(resolve(directory, '../../public/pocket-bullseye-demo.html'), 'utf8');
const copy = await readFile(resolve(directory, 'product-growth-assets.md'), 'utf8');

test('unpublished synthetic example forbids requests and accidental upload/purchase entry points', () => {
  assert.match(source, /connect-src 'none'/);
  assert.match(source, /default-src 'none'/);
  assert.match(source, /noindex, nofollow/);
  assert.doesNotMatch(source, /<input|<form|<iframe|<img|<link\b|<script[^>]+src=/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.match(source, /SYNTHETIC DEMO/);
  assert.match(source, /not a scanner result/);
  assert.match(source, /not a measured model true negative/);
  assert.doesNotMatch(source, /\b(?:accuracy|win rate)\s*(?:of\s*)?\d+%/i);
});

test('standalone demonstration JavaScript parses without a build step', () => {
  const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});

test('draft store fields fit limits and retain honest public product identity', () => {
  const limits = [['App name',30],['Subtitle',30],['Promotional text',170],['Keywords',100]];
  for (const [label,limit] of limits) {
    const line = copy.split('\n').find(line => line.startsWith('**'+label+' ('));
    assert.ok(line, 'Missing field '+label);
    const match = line.match(/\((\d+) characters\):\*\* (.*)$/);
    assert.ok(match, 'Invalid field '+label);
    const [,declared,value] = match;
    assert.equal(value.length, Number(declared), 'Wrong declared count '+label);
    assert.ok(value.length <= limit, 'Over limit '+label);
    if (label === 'App name') assert.match(value, /^Pocket Bullseye/);
  }
  assert.match(copy, /DRAFT \/ NOT PUBLISHED \/ NO OUTREACH SENT/);
});
