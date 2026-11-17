import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingActivities, budgetBalance } from '../src/features/dashboard/dashboard-data.js';

test('shows activities today and later in chronological order, including unscheduled ones', () => {
  const days = [
    { date: '2026-06-09', activities: [{ id: 1, time: '10:00' }] },
    { date: '2026-06-10', activities: [{ id: 2, time: null }, { id: 3, time: '09:00' }] },
    { date: '2026-06-11', activities: [{ id: 4, time: '08:00' }] },
  ];
  assert.deepEqual(upcomingActivities(days, '2026-06-10').map((item) => item.id), [3, 2, 4]);
});

test('shows overspending as a positive over-budget amount', () => {
  assert.deepEqual(budgetBalance({ remainingBudget: '-25.50', overBudget: '25.50' }), { label: 'Over budget', amount: '25.50' });
  assert.deepEqual(budgetBalance({ remainingBudget: '0.00', overBudget: '0.00' }), { label: 'Remaining', amount: '0.00' });
});
