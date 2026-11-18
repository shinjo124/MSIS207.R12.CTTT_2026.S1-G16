import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBudget } from '../src/services/budget-summary.js';

test('sums recorded actual spend by category and reports remaining budget', () => {
  assert.deepEqual(summarizeBudget('100.00', [
    { category: 'food_drink', plannedCost: '20.00', actualSpend: '25.25' },
    { category: 'food_drink', plannedCost: '30.00', actualSpend: '10.75' },
    { category: 'transport', plannedCost: '10.25', actualSpend: '14.00' },
    { category: 'sightseeing', plannedCost: '5.25', actualSpend: null },
  ]), {
    budget: '100.00',
    plannedTotal: '65.50',
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
    { category: 'food_drink', plannedCost: '1.00', actualSpend: '0.00' },
    { category: 'transport', plannedCost: '9.00', actualSpend: '9.05' },
  ]), {
    budget: '8.00',
    plannedTotal: '10.00',
    totalActualSpend: '9.05',
    remainingBudget: '-1.05',
    overBudget: '1.05',
    spendByCategory: [
      { category: 'food_drink', amount: '0.00' },
      { category: 'transport', amount: '9.05' },
    ],
  });
});
