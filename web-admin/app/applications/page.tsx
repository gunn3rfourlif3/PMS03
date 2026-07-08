'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, EmptyState, Modal, ConfirmModal, Field } from '@/components/ui';

const tone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'screening' ? 'brand' : 'muted';

export default function ApplicationsPage() {
  const router = useRouter();
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
      <PageHeader title="Applications" subtitle="Screen and decide on tenant applications" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Applicant</th><th className="px-5 py-3 font-semibold">Email</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Recommendation</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-white/40 hover:bg-white/30">
                  <td className="px-5 py-3 font-medium">{a.applicantName}</td>
                  <td className="px-5 py-3 text-muted">{a.applicantEmail}</td>
                  <td className="px-5 py-3"><Badge tone={tone(a.status)}>{a.status}</Badge></td>
                  <td className="px-5 py-3">{a.screeningResult?.recommendation ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {a.status === 'submitted' && <Button variant="ghost" onClick={() => setScreenFor(a)}>Screen</Button>}
                      {a.status === 'screening' && (<>
                        <Button onClick={() => openApprove(a)}>Approve</Button>
                        <Button variant="ghost" onClick={() => setRejectFor(a)}>Reject</Button>
                      </>)}
                    </div>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={5}><EmptyState>No applications yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Screen */}
      <Modal open={!!screenFor} onClose={() => setScreenFor(null)} title={`Screen ${screenFor?.applicantName ?? ''}`}
        footer={<>
          <Button variant="ghost" onClick={() => setScreenFor(null)} disabled={busy}>Cancel</Button>
          <Button onClick={runScreen} loading={busy}>Run screening</Button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monthly income (R)"><input className="input" value={income} onChange={(e) => setIncome(e.target.value)} inputMode="numeric" /></Field>
          <Field label="Credit score"><input className="input" value={credit} onChange={(e) => setCredit(e.target.value)} inputMode="numeric" /></Field>
        </div>
      </Modal>

      {/* Approve */}
      <Modal open={!!approveFor} onClose={() => setApproveFor(null)} title={`Approve ${approveFor?.applicantName ?? ''}`}
        footer={<>
          <Button variant="ghost" onClick={() => setApproveFor(null)} disabled={busy}>Cancel</Button>
          <Button onClick={runApprove} loading={busy} disabled={!startDate}>Approve &amp; create lease</Button>
        </>}>
        <p className="mb-4 text-sm text-muted">Approving creates a lease for this applicant starting on:</p>
        <Field label="Lease start date"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
      </Modal>

      {/* Reject */}
      <ConfirmModal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onConfirm={runReject}
        loading={busy}
        tone="danger"
        confirmLabel="Reject application"
        title={`Reject ${rejectFor?.applicantName ?? 'this applicant'}?`}
        message="The applicant will be marked rejected. You can't undo this."
      />
    </div>
  );
}
