import test from 'node:test';
import assert from 'node:assert/strict';
import { settleUp, splitEqually, validatePersonName } from '../src/services/split-bill.js';

const people = [{ id: 1, name: 'Kiệt' }, { id: 2, name: 'Lâm' }, { id: 3, name: 'An' }];

test('equal shares add up exactly', () => {
  const shares = splitEqually(100000n, 3);
  assert.deepEqual(shares, [33334n, 33333n, 33333n]);
  assert.equal(shares.reduce((a, b) => a + b, 0n), 100000n);
});

test('one payer for everyone: the others each owe a third', () => {
  const { balances, transfers, unassigned } = settleUp(people, [{ activityId: 1, amount: '300000', paidBy: 1, participants: [] }]);
  assert.deepEqual(balances.map((b) => b.net), ['200000.00', '-100000.00', '-100000.00']);
  assert.deepEqual(transfers, [{ from: 2, to: 1, amount: '100000.00' }, { from: 3, to: 1, amount: '100000.00' }]);
  assert.equal(unassigned, 0);
});

test('chosen participants and several payers settle with few transfers', () => {
  const { balances, transfers } = settleUp(people, [
    { activityId: 1, amount: '600000', paidBy: 1, participants: [] },
    { activityId: 2, amount: '200000', paidBy: 2, participants: [2, 3] },
    { activityId: 3, amount: '90000', paidBy: 3, participants: [1, 3] },
  ]);
  assert.deepEqual(balances.map((b) => [b.paid, b.share, b.net]), [
    ['600000.00', '245000.00', '355000.00'],
    ['200000.00', '300000.00', '-100000.00'],
    ['90000.00', '345000.00', '-255000.00'],
  ]);
  assert.deepEqual(transfers, [{ from: 3, to: 1, amount: '255000.00' }, { from: 2, to: 1, amount: '100000.00' }]);
});

test('expenses without a payer are counted as unassigned', () => {
  const result = settleUp(people, [{ activityId: 1, amount: '50000', paidBy: null, participants: [] }, { activityId: 2, amount: '0', paidBy: 1 }]);
  assert.equal(result.unassigned, 2);
  assert.deepEqual(result.transfers, []);
});

test('person names are trimmed and limited', () => {
  assert.equal(validatePersonName('  Trần   Quốc Kiệt '), 'Trần Quốc Kiệt');
  assert.equal(validatePersonName(''), null);
  assert.equal(validatePersonName('x'.repeat(61)), null);
});
