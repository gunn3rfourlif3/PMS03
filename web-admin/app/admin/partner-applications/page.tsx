'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { GlassCard, Button, Badge, PageHeader, EmptyState, Modal, Field } from '@/components/ui';

type Row = { id: string; type: string; contactName?: string; fullName?: string; companyName?: string; contactEmail: string; status: string; createdAt: string };
const STATUSES = ['submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'all'];
const tone = (s: string): any => ({ submitted: 'brand', under_review: 'brand', info_requested: 'muted', approved: 'success', rejected: 'danger', draft: 'muted' }[s] ?? 'muted');
const nameOf = (r: Row) => r.companyName || r.fullName || r.contactName || r.contactEmail;

export default function PartnerApplicationsPage() {
  const [status, setStatus] = useState('submitted');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = () => { setRows(null); api.partnerApplications(status).then(setRows).catch((e) => { setErr(e.message); setRows([]); }); };
  useEffect(load, [status]);

  return (
    <div>
      <PageHeader title="Partner applications" subtitle="Vet KYC/KYB submissions, then approve to provision the partner + login." />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${status === s ? 'bg-brand text-onbrand' : 'bg-black/[0.04] text-muted hover:text-ink'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {rows === null ? <p className="text-muted">Loading…</p>
        : rows.length === 0 ? <EmptyState>No {status === 'all' ? '' : status.replace('_', ' ')} applications.</EmptyState>
        : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <GlassCard key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-heading text-lg font-bold text-ink">{nameOf(r)}
                    <span className="ml-2 align-middle text-xs font-normal capitalize text-muted">· {r.type}</span>
                  </div>
                  <div className="text-sm text-muted">{r.contactEmail} · {new Date(r.createdAt).toLocaleDateString('en-ZA')}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={tone(r.status)}>{r.status.replace('_', ' ')}</Badge>
                  <Button variant="ghost" onClick={() => setOpenId(r.id)}>Review →</Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

      {openId && <ReviewModal id={openId} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); load(); }} />}
    </div>
  );
}

function Row2({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return <div className="flex justify-between gap-4 border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{label}</span><span className="text-right font-medium text-ink">{value}</span></div>;
}

function ReviewModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [rate, setRate] = useState('0.10');
  const [reason, setReason] = useState('');

  useEffect(() => { api.partnerApplication(id).then(setD).catch((e) => setErr(e.message)); }, [id]);

  const act = async (fn: () => Promise<any>, tag: string) => {
    setBusy(tag); setErr('');
    try { await fn(); onDone(); } catch (e: any) { setErr(e.message); setBusy(''); }
  };

  const title = d ? `${d.business?.companyName || d.individual?.fullName || d.contact?.name || d.contact?.email} — ${d.type}` : 'Application';

  return (
    <Modal open onClose={onClose} title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="ghost" onClick={() => act(() => api.requestInfoApplication(id, reason || undefined), 'info')} loading={busy === 'info'}>Request info</Button>
          <Button variant="ghost" onClick={() => act(() => api.rejectApplication(id, reason || undefined), 'reject')} loading={busy === 'reject'}>Reject</Button>
          <Button onClick={() => act(() => api.approveApplication(id, { commissionRate: Number(rate) || 0.10 }), 'approve')} loading={busy === 'approve'} disabled={d?.status === 'approved'}>Approve</Button>
        </>
      }>
      {!d ? <p className="text-muted">Loading…</p> : (
        <div className="space-y-4">
          {err && <div className="rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Contact</div>
            <Row2 label="Name" value={d.contact?.name} />
            <Row2 label="Email" value={d.contact?.email} />
            <Row2 label="Phone" value={d.contact?.phone} />
          </div>

          {d.individual && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Individual (KYC)</div>
              <Row2 label="Full name" value={d.individual.fullName} />
              <Row2 label="ID type" value={d.individual.idType} />
              <Row2 label="ID number" value={d.individual.idNumber} />
              <Row2 label="Date of birth" value={d.individual.dob} />
              <Row2 label="Residential address" value={d.individual.residentialAddress} />
            </div>
          )}

          {d.business && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Business (KYB)</div>
              <Row2 label="Company" value={d.business.companyName} />
              <Row2 label="Registration no." value={d.business.registrationNumber} />
              <Row2 label="VAT no." value={d.business.vatNumber} />
              <Row2 label="Business address" value={d.business.businessAddress} />
              <Row2 label="Directors" value={(d.business.directors ?? []).map((x: any) => `${x.name ?? ''}${x.idNumber ? ` (${x.idNumber})` : ''}`).join('; ')} />
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Banking (masked)</div>
            <Row2 label="Bank" value={d.banking?.bankName} />
            <Row2 label="Holder" value={d.banking?.accountHolder} />
            <Row2 label="Account" value={d.banking?.accountNumber} />
            <Row2 label="Branch" value={d.banking?.branchCode} />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Documents</div>
            {(d.documents ?? []).length === 0 ? <p className="text-sm text-muted">None uploaded.</p> : (
              <ul className="space-y-1">
                {d.documents.map((doc: any, i: number) => (
                  <li key={i}><a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">{doc.docType.replace('_', ' ')} — {doc.name}</a></li>
                ))}
              </ul>
            )}
          </div>

          {d.risk && Object.keys(d.risk).length > 0 && (
            <div className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-muted">
              Automated check: {d.risk.mode ?? 'manual'}{d.risk.passed === null ? ' — needs human review' : d.risk.passed ? ' — passed' : ' — flagged'}
              {Array.isArray(d.risk.findings) && d.risk.findings.length ? ` (${d.risk.findings.join(', ')})` : ''}
            </div>
          )}

          <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
            <Field label="Commission rate (0–1)"><input className="input" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
            <Field label="Reason / note (reject or request-info)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
