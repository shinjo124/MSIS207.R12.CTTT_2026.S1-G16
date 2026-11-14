import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBudget } from '../src/services/budget-summary.js';

test('sums recorded actual spend by category and reports remaining budget', () => {
  assert.deepEqual(summarizeBudget('100.00', [
    { category: 'food_drink', actualSpend: '25.25' },
    { category: 'food_drink', actualSpend: '10.75' },
    { category: 'transport', actualSpend: '14.00' },
    { category: 'sightseeing', actualSpend: null },
  ]), {
    budget: '100.00',
    totalActualSpend: '50.00',
    remainingBudget: '50.00',
    overBudget: '0.00',
    spendByCategory: [
      { category: 'food_drink', amount: '36.00' },
      { category: 'transport', amount: '14.00' },
    ],
  });
});

test('keeps recorded zero and reports signed remaining and excess', () => {
  assert.deepEqual(summarizeBudget('8.00', [
    { category: 'food_drink', actualSpend: '0.00' },
    { category: 'transport', actualSpend: '9.05' },
  ]), {
    budget: '8.00',
    totalActualSpend: '9.05',
    remainingBudget: '-1.05',
    overBudget: '1.05',
    spendByCategory: [
      { category: 'food_drink', amount: '0.00' },
      { category: 'transport', amount: '9.05' },
    ],
  });
});
