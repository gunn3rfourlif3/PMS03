'use client';

/**
 * Record a payment that arrived outside any gateway.
 *
 * SEALED DEPLOYMENTS ONLY. The caller hides the trigger on `manualPayments`
 * and the API refuses the route anyway — a hand-confirm where a gateway is
 * collecting is a way to mark an invoice paid for money that never came.
 *
 * ONE INVOICE AT A TIME, CHOSEN DELIBERATELY. A lease in arrears has several
 * unpaid invoices, and guessing which one a R5 000 note belongs against is the
 * mistake `statement-import.ts` refuses to make for the same reason: money
 * allocated to the wrong invoice is worse than money left unallocated, because
 * the first looks finished. The oldest is preselected, not assumed.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Field, Modal } from './ui';
import { useLocale } from './locale-provider';

interface Outstanding {
  id: string;
  period: string;
  dueDate: string;
  total: number;
  status: string;
  outstanding: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function RecordPaymentModal({
  row, onClose, onRecorded,
}: {
  /** A rent-roll row: { lease_id, unit, outstanding }. Null when closed. */
  row: any | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const { t, money } = useLocale();
  const [invoices, setInvoices] = useState<Outstanding[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'eft'>('cash');
  const [reference, setReference] = useState('');
  const [receivedOn, setReceivedOn] = useState(today());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setErr(''); setReference(''); setReceivedOn(today()); setMethod('cash');
    api.outstandingInvoices(row.lease_id)
      .then((list: Outstanding[]) => {
        setInvoices(list);
        const first = list[0];
        setInvoiceId(first?.id ?? '');
        // The amount defaults to what that invoice still owes, because a
        // partial payment is the normal case in arrears and the full total
        // would be the wrong default more often than not.
        setAmount(first ? String(first.outstanding) : '');
      })
      .catch((e: any) => setErr(e.message));
  }, [row]);

  const pick = (id: string) => {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) setAmount(String(inv.outstanding));
  };

  const submit = async () => {
    const value = Number(amount);
    if (!invoiceId || !Number.isFinite(value) || value <= 0) {
      setErr(t('payment.amount')); return;
    }
    setBusy(true); setErr('');
    try {
      await api.recordPayment(invoiceId, {
        amount: value,
        method,
        reference: reference.trim() || undefined,
        receivedOn,
      });
      onRecorded();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const selected = invoices.find((i) => i.id === invoiceId);

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={row ? t('payment.recordFor', { unit: row.unit }) : ''}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy || !invoiceId}>
            {t('payment.confirm')}
          </Button>
        </div>
      }
    >
      {err && <div className="mb-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {invoices.length === 0 ? (
        <p className="py-4 text-sm text-muted">{t('payment.noOutstanding')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label={t('payment.invoice')}>
            <select className="input" value={invoiceId} onChange={(e) => pick(e.target.value)}>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {t('payment.invoiceOption', {
                    period: i.period,
                    due: i.dueDate,
                    amount: money(i.outstanding),
                  })}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('payment.amount')}>
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label={t('payment.receivedOn')}>
              <input
                className="input"
                type="date"
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
              />
            </Field>
          </div>

          <Field label={t('payment.method')}>
            <select
              className="input"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'eft')}
            >
              <option value="cash">{t('payment.method.cash')}</option>
              <option value="eft">{t('payment.method.eft')}</option>
            </select>
          </Field>

          <Field label={t('payment.reference')}>
            <input
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('payment.referenceHint')}
            />
          </Field>

          {/* Said out loud at the moment of recording, not buried in a policy:
              this is the entry with no second source of evidence. */}
          {method === 'cash' && (
            <p className="text-xs text-muted">{t('payment.cashWarning')}</p>
          )}

          {selected && Number(amount) > selected.outstanding && (
            <p className="text-xs text-danger">
              {t('payment.invoiceOption', {
                period: selected.period,
                due: selected.dueDate,
                amount: money(selected.outstanding),
              })}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
