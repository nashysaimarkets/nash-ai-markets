// Run against the historical or proposed additive function source. All state is
// in-memory and disposable. No hosted DB, credentials, or outbound calls.
const { PGlite } = await import(process.env.POCKET_QA_PGLITE_MODULE ?? '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const repo = resolve(process.argv[2] ?? '../monaco');
const migration = process.argv[3] ?? 'supabase/migrations/20261014143000_bind_pocket_web_subscription_identity.sql';
const expectRejected = process.argv[4] === '--expect-rejected';
const source = await readFile(resolve(repo, migration), 'utf8');
const start = source.search(/create(?: or replace)? function private\.sync_pocket_web_subscription\(/i);
assert.ok(start >= 0, 'actual subscription function must exist');
const end = source.indexOf('end $$;', start);
assert.ok(end >= 0, 'complete PL/pgSQL function must exist');
const functionSql = source.slice(start, end + 'end $$;'.length);
const db = new PGlite();
try {
  await db.exec(await readFile(new URL('./sql/support/pocket-identity-regression-bootstrap.sql', import.meta.url), 'utf8'));
  await db.exec(functionSql);
  await db.exec(`
    select private.sync_pocket_web_subscription('11111111-1111-4111-8111-111111111111','a@example.invalid','cus_a','sub_a',true,now()+interval '1 day',100);
    select private.sync_pocket_web_subscription('22222222-2222-4222-8222-222222222222','b@example.invalid','cus_b','sub_b',true,now()+interval '1 day',100);
  `);
  const before = (await db.query("select * from private.pocket_web_subscriptions where stripe_subscription_id='sub_a'")).rows[0];
  let rejected = false, rejection = null;
  try {
    await db.exec("select private.sync_pocket_web_subscription('22222222-2222-4222-8222-222222222222','b@example.invalid','cus_b','sub_a',true,now()+interval '2 days',200)");
  } catch (error) { rejected = true; rejection = error.message; }
  const after = (await db.query("select * from private.pocket_web_subscriptions where stripe_subscription_id='sub_a'")).rows[0];
  if (expectRejected) {
    assert.equal(rejected, true, 'foreign pre-bound UUID must be rejected');
    assert.match(rejection ?? '', /pocket_subscription_identity_conflict/);
    assert.deepEqual(after, before, 'a denied update must not alter the subscription');
  } else {
    assert.equal(rejected, false, 'baseline reproducer expects the guard defect');
    assert.equal(after.email, 'b@example.invalid');
    assert.equal(after.app_user_id, before.app_user_id);
    assert.equal(after.stripe_customer_id, before.stripe_customer_id);
    assert.equal(after.last_event_created_at, 200);
  }
  console.log(JSON.stringify({ migration, engine: 'in-memory PostgreSQL via PGlite 0.5.10', scope: 'Actual UUID-bound function; synthetic minimal tables; founding award side effect stubbed; no hosted DB or privilege/migration-graph claim', expected: expectRejected ? 'reject and preserve row' : 'reproduce mutable-FOUND corruption', rejected, rejection, rowPreserved: JSON.stringify(before) === JSON.stringify(after), result: 'PASS' }));
} finally { await db.close(); }
