'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, EmptyState, Modal, ConfirmModal, Field, BentoTile } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const tone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'screening' ? 'brand' : 'muted';

const STATUSES = ['submitted', 'screening', 'approved', 'rejected'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`applications.status.${st}` as MessageKey) : st;

export default function ApplicationsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [apps, setApps] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // modal state
  const [screenFor, setScreenFor] = useState<any>(null);
  const [income, setIncome] = useState('30000');
  const [credit, setCredit] = useState('710');
  const [approveFor, setApproveFor] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [rejectFor, setRejectFor] = useState<any>(null);
  const [viewFor, setViewFor] = useState<any>(null);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);

  const load = async () => { setErr(''); try { setApps(await api.applications()); } catch (e: any) { setErr(e.message); } };

  const runScreen = async () => {
    if (!screenFor) return;
    setBusy(true); setErr('');
    try { await api.screenApplication(screenFor.id, { monthlyIncome: Number(income) || 0, creditScore: Number(credit) || 0 }); setScreenFor(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const runApprove = async () => {
    if (!approveFor || !startDate) return;
    setBusy(true); setErr('');
    try { await api.approveApplication(approveFor.id, startDate); setApproveFor(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const runReject = async () => {
    if (!rejectFor) return;
    setBusy(true); setErr('');
    try { await api.rejectApplication(rejectFor.id); setRejectFor(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const openApprove = (a: any) => { setStartDate(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)); setApproveFor(a); };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title={t('applications.title')} subtitle={t('applications.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="blue" value={String(apps.length)} label={t('applications.tile.total')} />
        <BentoTile tone="amber" value={String(apps.filter((a) => a.status === 'screening').length)} label={t('applications.tile.screening')} />
        <BentoTile tone="green" value={String(apps.filter((a) => a.status === 'approved').length)} label={t('applications.tile.approved')} />
        <BentoTile tone="coral" value={String(apps.filter((a) => a.status === 'rejected').length)} label={t('applications.tile.rejected')} />
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('applications.th.applicant')}</th><th className="px-5 py-3 font-semibold">{t('applications.th.email')}</th><th className="px-5 py-3 font-semibold">{t('applications.th.status')}</th><th className="px-5 py-3 font-semibold">{t('applications.th.recommendation')}</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium">{a.applicantName}</td>
                  <td className="px-5 py-3 text-muted">{a.applicantEmail}</td>
                  <td className="px-5 py-3"><Badge tone={tone(a.status)}>{statusLabel(t, a.status)}</Badge></td>
                  {/* The screening recommendation comes from the API as free
                      text and is shown as sent — there is no fixed vocabulary
                      here to key against. */}
                  <td className="px-5 py-3">{a.screeningResult?.recommendation ?? t('common.none')}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setViewFor(a)}>{t('applications.view')}</Button>
                      {a.status === 'submitted' && <Button variant="ghost" onClick={() => setScreenFor(a)}>{t('applications.screen')}</Button>}
                      {a.status === 'screening' && (<>
                        <Button onClick={() => openApprove(a)}>{t('applications.approve')}</Button>
                        <Button variant="ghost" onClick={() => setRejectFor(a)}>{t('applications.reject')}</Button>
                      </>)}
                    </div>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={5}><EmptyState>{t('applications.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Screen */}
      <Modal open={!!screenFor} onClose={() => setScreenFor(null)} title={t('applications.screenTitle', { name: screenFor?.applicantName ?? '' })}
        footer={<>
          <Button variant="ghost" onClick={() => setScreenFor(null)} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={runScreen} loading={busy}>{t('applications.runScreening')}</Button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('applications.field.income')}><input className="input" value={income} onChange={(e) => setIncome(e.target.value)} inputMode="numeric" /></Field>
          <Field label={t('applications.field.creditScore')}><input className="input" value={credit} onChange={(e) => setCredit(e.target.value)} inputMode="numeric" /></Field>
        </div>
      </Modal>

      {/* Approve */}
      <Modal open={!!approveFor} onClose={() => setApproveFor(null)} title={t('applications.approveTitle', { name: approveFor?.applicantName ?? '' })}
        footer={<>
          <Button variant="ghost" onClick={() => setApproveFor(null)} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={runApprove} loading={busy} disabled={!startDate}>{t('applications.approveAndCreate')}</Button>
        </>}>
        <p className="mb-4 text-sm text-muted">{t('applications.approveBlurb')}</p>
        <Field label={t('applications.field.leaseStart')}><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
      </Modal>

      {/* Reject */}
      <ConfirmModal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onConfirm={runReject}
        loading={busy}
        tone="danger"
        confirmLabel={t('applications.rejectConfirm')}
        title={rejectFor?.applicantName
          ? t('applications.rejectTitle', { name: rejectFor.applicantName })
          : t('applications.rejectTitleFallback')}
        message={t('applications.rejectMessage')}
      />

      {/* View application details */}
      <Modal open={!!viewFor} onClose={() => setViewFor(null)} title={viewFor?.applicantName ?? t('applications.detailsTitle')}
        footer={<Button variant="ghost" onClick={() => setViewFor(null)}>{t('common.close')}</Button>}>
        {viewFor && <ApplicationDetails a={viewFor} />}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-line py-1.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{String(value)}</span>
    </div>
  );
}

function ApplicationDetails({ a }: { a: any }) {
  const { t, money: fmtMoney, date } = useLocale();
  const d = a.details ?? {};
  // Was a local `R${Number(n).toLocaleString('en-ZA')}` — hardcoded South
  // African grouping. Now the locale's formatter, which also carries the
  // currency symbol, so the template no longer prepends one.
  const money = (n: any) => (n ? fmtMoney(Number(n)) : undefined);
  return (
    <div>
      <Row label={t('applications.row.email')} value={a.applicantEmail} />
      <Row label={t('applications.row.phone')} value={a.applicantPhone} />
      <Row label={t('applications.row.id')} value={d.idNumber} />
      <Row label={t('applications.row.dob')} value={d.dateOfBirth ? date(d.dateOfBirth) : undefined} />
      <Row label={t('applications.row.address')} value={d.currentAddress} />
      {/* Employment status and employer arrive as the applicant's own free
          text, so they are shown as entered. */}
      <Row label={t('applications.row.employment')} value={d.employmentStatus} />
      <Row label={t('applications.row.employer')} value={d.employer} />
      <Row label={t('applications.row.income')} value={money(d.monthlyIncome)} />
      <Row label={t('applications.row.occupants')} value={d.occupants} />
      <Row label={t('applications.row.moveIn')} value={d.moveInDate ? date(d.moveInDate) : undefined} />
      <Row label={t('applications.row.pets')} value={d.pets
        ? (d.petDetails ? t('applications.petsYesWithDetail', { detail: d.petDetails }) : t('applications.yes'))
        : t('applications.no')} />
      <Row label={t('applications.row.consent')} value={d.consent ? t('applications.yes') : undefined} />
      {d.message && (
        <div className="mt-3">
          <div className="text-sm text-muted">{t('applications.message')}</div>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{d.message}</p>
        </div>
      )}
      {!a.applicantPhone && !d.idNumber && !d.message && (
        <p className="text-sm text-muted">{t('applications.noExtraDetails')}</p>
      )}
    </div>
  );
}
