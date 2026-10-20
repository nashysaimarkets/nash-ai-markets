import test from 'node:test';
import assert from 'node:assert/strict';
import { issuePocketCheckoutBaseline, provisionPocketCustomer, reconcilePocketCheckout, createPocketCheckoutRecoveryDriver } from '../app/lib/server/pocket-checkout-completion.ts';
test('new completion operations are offline and refuse absent independent authority', async () => {
  assert.equal((await issuePocketCheckoutBaseline({} as never, {} as never)).kind, 'HOLD');
  assert.equal((await provisionPocketCustomer({} as never, {} as never)).kind, 'HOLD');
  assert.equal((await reconcilePocketCheckout({} as never, {} as never)).kind, 'HOLD');
  assert.equal(typeof createPocketCheckoutRecoveryDriver, 'function');
});
