import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = () => readFile(new URL('../app/pocket/page.tsx', import.meta.url), 'utf8');
async function pageHandler() {
  const content = await source();
  const marker = 'export default async function PocketPage() {';
  const start = content.indexOf(marker);
  assert.ok(start >= 0, 'exercise the actual customer-page handler');
  const body = content.slice(start + marker.length, content.lastIndexOf('}'));
  assert.match(body, /return <PocketNext macroContext=\{macroContext\} \/>;/);
  // Replace only JSX construction; retain the real async preparation/fallback.
  const executable = body.replace('return <PocketNext macroContext={macroContext} />;', 'return { component: "PocketNext", macroContext };');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction('getVerifiedMacroContext', 'createUnavailableMacroContext', executable);
}

test('Apple-first customer entrypoint has no broker availability dependency or injected broker controls', async () => {
  const content = await source();
  assert.doesNotMatch(content, /readPocketIgDemoAvailability|pocket-ig-demo-access|from ["']next\/headers["']/);
  assert.doesNotMatch(content, /igDemoAvailable|igDemoDisconnectAvailable|igDemoOwnerScope|\.\.\.igDemo/);
  assert.match(content, /return <PocketNext macroContext=\{macroContext\} \/>;/);
});
test('Apple-first customer entrypoint retains the real macro context without any broker binding', async () => {
  const run = await pageHandler();
  const context = Object.freeze({status: 'fixture-verified'});
  const routes = [];
  const result = await run(async input => { routes.push(input.route); return context; }, () => { throw Error('unexpected fallback'); });
  assert.deepEqual(routes, ['/pocket']);
  assert.equal(result.component, 'PocketNext');
  assert.equal(result.macroContext, context);
  assert.deepEqual(Object.keys(result), ['component', 'macroContext']);
});
test('Apple-first customer entrypoint retains unavailable-macro fallback instead of requiring broker setup', async () => {
  const run = await pageHandler();
  const unavailable = Object.freeze({status: 'unavailable'});
  let fallbacks = 0;
  const result = await run(async () => { throw Error('synthetic macro outage'); }, () => { fallbacks++; return unavailable; });
  assert.equal(fallbacks, 1);
  assert.equal(result.component, 'PocketNext');
  assert.equal(result.macroContext, unavailable);
});
