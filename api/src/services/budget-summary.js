function toCents(value) {
  const text = String(value ?? '0');
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new TypeError('Budget values must be non-negative decimals with at most two places.');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
}

function fromCents(cents) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function summarizeBudget(budget, activities) {
  const budgetCents = toCents(budget);
  let totalCents = 0n;
  const categoryCents = new Map();

  for (const activity of activities) {
    if (activity.actualSpend == null) continue;
    const cents = toCents(activity.actualSpend);
    totalCents += cents;
    categoryCents.set(activity.category, (categoryCents.get(activity.category) || 0n) + cents);
  }

  return {
    budget: fromCents(budgetCents),
    totalActualSpend: fromCents(totalCents),
    remainingBudget: fromCents(budgetCents - totalCents),
    overBudget: fromCents(totalCents > budgetCents ? totalCents - budgetCents : 0n),
    spendByCategory: [...categoryCents]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, cents]) => ({ category, amount: fromCents(cents) })),
  };
}
