/**
 * Absolute (non-perspective) representation of a single group debt.
 * Built by the service layer from raw DB rows so the algorithm never
 * needs to know which user is "viewing" — payer and borrower are explicit.
 */
export type RawGroupDebt = {
  /** Display name of the person who is owed money (creditor / payer). */
  payerLabel: string;
  /** Display name of the person who owes money (debtor / borrower). */
  borrowerLabel: string;
  /** Remaining balance in integer cents (amount_cents − paid_cents). */
  remainingCents: number;
};

export type SimplifiedPayment = {
  from: string;
  to: string;
  amountCents: number;
};

/**
 * Computes the minimum set of payments to settle all active group debts.
 *
 * Operates on absolute payer/borrower labels so it correctly handles debts
 * between any pair of group members, not just those involving the current user.
 *
 * Algorithm:
 * 1. Net each participant's balance across all debts (integer cents).
 *    Positive = creditor (owed money). Negative = debtor (owes money).
 * 2. Greedily match the largest debtor to the largest creditor, settling
 *    min(debt, credit). Advance the exhausted pointer and repeat.
 *
 * Dev test cases:
 *
 * Case 1 — full 3-person cycle cancels to []:
 *   Input: [{payer:"B", borrower:"A", cents:2000},
 *           {payer:"C", borrower:"B", cents:2000},
 *           {payer:"A", borrower:"C", cents:2000}]
 *   Balances: A=0, B=0, C=0  →  result = []
 *
 * Case 2 — partial cycle leaves one remaining payment:
 *   Input: [{payer:"B", borrower:"A", cents:2000},   // A owes B $20
 *           {payer:"A", borrower:"C", cents:1500}]   // C owes A $15
 *   Balances: A=−500, B=+2000, C=−1500
 *   →  result: [{from:"C", to:"B", amountCents:1500},
 *               {from:"A", to:"B", amountCents: 500}]
 *
 * Case 3 — non-group debts ignored:
 *   Callers pre-filter by group_id before building RawGroupDebt[];
 *   non-group debts never reach this function.
 *
 * @param rawDebts  Absolute payer/borrower debt records for one group.
 */
export function simplifyGroupDebts(rawDebts: RawGroupDebt[]): SimplifiedPayment[] {
  if (rawDebts.length === 0) return [];

  // Build net balance map in integer cents to avoid floating-point drift.
  const balances = new Map<string, number>();
  function addBalance(name: string, deltaCents: number) {
    balances.set(name, (balances.get(name) ?? 0) + deltaCents);
  }

  for (const debt of rawDebts) {
    if (debt.remainingCents <= 0) continue;
    addBalance(debt.payerLabel, debt.remainingCents);     // creditor gains
    addBalance(debt.borrowerLabel, -debt.remainingCents); // debtor loses
  }

  const creditors: Array<{ name: string; cents: number }> = [];
  const debtors: Array<{ name: string; cents: number }> = [];
  for (const [name, bal] of balances) {
    if (bal > 0) creditors.push({ name, cents: bal });
    else if (bal < 0) debtors.push({ name, cents: -bal });
  }

  // Sort descending: pair the largest debtor with the largest creditor first.
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const result: SimplifiedPayment[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const cred = creditors[ci];
    const debt = debtors[di];
    const settle = Math.min(cred.cents, debt.cents);
    result.push({ from: debt.name, to: cred.name, amountCents: settle });
    cred.cents -= settle;
    debt.cents -= settle;
    if (cred.cents === 0) ci++;
    if (debt.cents === 0) di++;
  }

  return result;
}
