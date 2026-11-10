/**
 * What an invoice still owes, in SQL, in one place.
 *
 * THE BUG THIS EXISTS TO KILL. Three reports — the rent roll, the arrears
 * ageing and the god's-eye portfolio state — each summed the FULL total of
 * every unpaid invoice. Record R5,000 against a R12,000 invoice and all three
 * still read R12,000, while the record-payment modal, which computed the real
 * figure, read R7,000. Staff reading a rent roll that ignores the payment they
 * just captured will capture it again.
 *
 * The three agreeing on a wrong number was deliberate once: a known
 * simplification, applied consistently, beats one report quietly disagreeing.
 * That stopped being true when manual payment capture shipped, because the
 * sealed on-site mode is the one where part-payments in cash are normal rather
 * than rare.
 *
 * So the definition lives here and nowhere else. A fourth report that needs it
 * imports it; it does not write the expression again.
 */

/**
 * The outstanding value of one invoice: its total, less every succeeded
 * payment allocated to it.
 *
 * `alias` is the invoices alias in the surrounding query. The inner aliases are
 * `pay` and `alloc` rather than `p` and `a` on purpose — the portfolio query
 * already binds `p` to `properties`, and a correlated subquery that shadows an
 * outer alias is legal SQL and a trap for the next reader.
 *
 * NOT clamped at zero. An overpayment shows as a credit and offsets other
 * arrears on the same lease, which is what a tenant in credit actually means.
 * Clamping here would make this disagree with the modal again, which is the
 * whole fault being fixed.
 *
 * The `jsonb_typeof` guard is insurance, not decoration: `jsonb_array_elements`
 * RAISES on a JSON object rather than returning no rows, and this code ships to
 * machines that cannot be patched remotely.
 *
 * It sits inside the function's argument, not in the WHERE clause, and that
 * placement is the whole point. As a WHERE condition it appears to work —
 * Postgres pushes the filter down to the payments scan and the bad row never
 * reaches the function — but evaluation order between WHERE and a
 * FROM-clause set-returning function is a planner decision, not a guarantee.
 * A different plan on a different version raises in production. Wrapped in the
 * CASE it cannot raise under any plan, and costs nothing.
 */
export function invoiceOutstanding(alias = 'i'): string {
  return `(${alias}.total - COALESCE((
    SELECT SUM((alloc->>'amount')::numeric)
      FROM payments pay,
           jsonb_array_elements(
             CASE WHEN jsonb_typeof(pay.allocation) = 'array'
                  THEN pay.allocation ELSE '[]'::jsonb END
           ) alloc
     WHERE pay.status = 'succeeded'
       AND (alloc->>'invoiceId') = ${alias}.id::text
  ), 0))`;
}

/**
 * The invoice statuses that carry money owed.
 *
 * `draft` is not yet a claim on the tenant and `void` has been withdrawn, so
 * neither belongs in an arrears figure. The rent roll used `status <> 'paid'`
 * and so counted both — a second fault in the same line as the first.
 */
export const OWING_INVOICE_STATUSES = "('issued', 'partly_paid', 'overdue')";
