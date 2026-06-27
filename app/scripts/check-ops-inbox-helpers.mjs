import assert from 'node:assert/strict';
import {
  inventoryAlertKey,
  isOpsEntryOnBangkokDay,
  opsEntryBangkokDay,
} from '../src/lib/opsInboxHelpers.js';

assert.equal(
  inventoryAlertKey({ task_key: 'cake-stock', payload: { cakeName: '  Blueberry Cake ', branchName: ' สาขากาดน้ำทอง ' } }),
  'cake-stock::blueberry cake::สาขากาดน้ำทอง'
);
assert.equal(
  inventoryAlertKey({ task_key: 'cake-stock', payload: { cakeName: 'Blueberry Cake', branchName: 'สาขากาดกองเก่า' } }),
  'cake-stock::blueberry cake::สาขากาดกองเก่า'
);
assert.equal(
  inventoryAlertKey({ task_key: 'inventory', payload: { itemName: ' นมสด ' } }),
  'inventory::นมสด::'
);
assert.equal(inventoryAlertKey({ task_key: 'inventory', payload: {} }), '');

const beforeBangkokMidnight = { created_at: '2026-06-26T16:59:59.999Z' };
const afterBangkokMidnight = { created_at: '2026-06-26T17:00:00.000Z' };
assert.equal(opsEntryBangkokDay(beforeBangkokMidnight), '2026-06-26');
assert.equal(opsEntryBangkokDay(afterBangkokMidnight), '2026-06-27');
assert.equal(isOpsEntryOnBangkokDay(afterBangkokMidnight, '2026-06-27'), true);
assert.equal(isOpsEntryOnBangkokDay(beforeBangkokMidnight, '2026-06-27'), false);
assert.equal(isOpsEntryOnBangkokDay({ created_at: 'not-a-date' }, '2026-06-27'), false);

console.log('OPS inbox helper checks passed');
