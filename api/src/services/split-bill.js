// Split bill math. Money is handled in integer hundredths (BigInt) so totals never drift.
function toCents(value) {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(String(value ?? '0'));
  if (!match) throw new TypeError('Amounts must be non-negative decimals with at most two places.');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
}

function fromCents(cents) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

// Equal shares; leftover hundredths go one each to the first people so the shares add up exactly.
export function splitEqually(amountCents, count) {
  if (count <= 0) return [];
  const size = BigInt(count);
  const base = amountCents / size;
  const extra = Number(amountCents % size);
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1n : 0n));
}

// people: [{ id, name }]
// expenses: [{ activityId, amount (decimal string), paidBy (person id | null), participants ([] = everyone) }]
// Returns per-person balances and the fewest simple transfers that settle them.
export function settleUp(people, expenses) {
  const ids = people.map((person) => Number(person.id));
  const known = new Set(ids);
  const paid = new Map(ids.map((id) => [id, 0n]));
  const owed = new Map(ids.map((id) => [id, 0n]));
  let unassigned = 0;

  for (const expense of expenses) {
    const amount = toCents(expense.amount);
    const payer = Number(expense.paidBy);
    const sharers = (expense.participants?.length ? expense.participants : ids).map(Number).filter((id) => known.has(id)).sort((a, b) => a - b);
    if (!amount || !known.has(payer) || !sharers.length) { unassigned += 1; continue; }
    paid.set(payer, paid.get(payer) + amount);
    splitEqually(amount, sharers.length).forEach((share, index) => owed.set(sharers[index], owed.get(sharers[index]) + share));
  }

  const balances = people.map((person) => {
    const id = Number(person.id);
    const net = paid.get(id) - owed.get(id);
    return { personId: id, name: person.name, paid: fromCents(paid.get(id)), share: fromCents(owed.get(id)), net: fromCents(net), netCents: net };
  });

  // Greedy: the person owed the most is paid by the person who owes the most, until everyone is even.
  const creditors = balances.filter((b) => b.netCents > 0n).map((b) => ({ id: b.personId, left: b.netCents })).sort((a, b) => (b.left > a.left ? 1 : b.left < a.left ? -1 : a.id - b.id));
  const debtors = balances.filter((b) => b.netCents < 0n).map((b) => ({ id: b.personId, left: -b.netCents })).sort((a, b) => (b.left > a.left ? 1 : b.left < a.left ? -1 : a.id - b.id));
  const transfers = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = creditors[c].left < debtors[d].left ? creditors[c].left : debtors[d].left;
    transfers.push({ from: debtors[d].id, to: creditors[c].id, amount: fromCents(amount) });
    creditors[c].left -= amount;
    debtors[d].left -= amount;
    if (creditors[c].left === 0n) c += 1;
    if (debtors[d].left === 0n) d += 1;
  }

  return { balances: balances.map(({ netCents, ...rest }) => rest), transfers, unassigned };
}

export function validatePersonName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name && name.length <= 60 ? name : null;
}
