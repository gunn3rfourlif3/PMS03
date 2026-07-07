'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, EmptyState } from '@/components/ui';

const tone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'screening' ? 'brand' : 'muted';

export default function ApplicationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [apps, setApps] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);

  const load = async () => { setErr(''); try { setApps(await api.applications()); } catch (e: any) { setErr(e.message); } };
  const doScreen = async (id: string) => {
    const income = Number(window.prompt('Monthly income (R)', '30000') || 0);
    const credit = Number(window.prompt('Credit score', '710') || 0);
    try { await api.screenApplication(id, { monthlyIncome: income, creditScore: credit }); await load(); } catch (e: any) { setErr(e.message); }
  };
  const doApprove = async (id: string) => {
    const start = window.prompt('Lease start date', '2026-08-01'); if (!start) return;
    try { await api.approveApplication(id, start); await load(); } catch (e: any) { setErr(e.message); }
  };
  const doReject = async (id: string) => {
    if (!window.confirm('Reject this application?')) return;
    try { await api.rejectApplication(id); await load(); } catch (e: any) { setErr(e.message); }
  };

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
                      {a.status === 'submitted' && <Button variant="ghost" onClick={() => doScreen(a.id)}>Screen</Button>}
                      {a.status === 'screening' && (<>
                        <Button onClick={() => doApprove(a.id)}>Approve</Button>
                        <Button variant="ghost" onClick={() => doReject(a.id)}>Reject</Button>
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
    </div>
  );
}
