'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';

export default function ApplicationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [apps, setApps] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    load();
  }, []);

  const load = async () => {
    setErr('');
    try { setApps(await api.applications()); }
    catch (e: any) { setErr(e.message); }
  };

  const doScreen = async (id: string) => {
    const income = Number(window.prompt('Monthly income (R)', '30000') || 0);
    const credit = Number(window.prompt('Credit score', '710') || 0);
    try { await api.screenApplication(id, { monthlyIncome: income, creditScore: credit }); await load(); }
    catch (e: any) { setErr(e.message); }
  };
  const doApprove = async (id: string) => {
    const start = window.prompt('Lease start date', '2026-08-01');
    if (!start) return;
    try { await api.approveApplication(id, start); await load(); }
    catch (e: any) { setErr(e.message); }
  };
  const doReject = async (id: string) => {
    if (!window.confirm('Reject this application?')) return;
    try { await api.rejectApplication(id); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  if (!ready) return null;

  return (
    <div className="container">
      <div className="h1">Applications</div>
      <p className="sub">Screen and decide on tenant applications</p>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <table>
          <thead><tr><th>Applicant</th><th>Email</th><th>Status</th><th>Recommendation</th><th></th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{a.applicantName}</td>
                <td>{a.applicantEmail}</td>
                <td><span className="badge">{a.status}</span></td>
                <td>{a.screeningResult?.recommendation ?? '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {a.status === 'submitted' && <button className="btn secondary" onClick={() => doScreen(a.id)}>Screen</button>}
                  {a.status === 'screening' && (
                    <>
                      <button className="btn" onClick={() => doApprove(a.id)}>Approve</button>{' '}
                      <button className="btn secondary" onClick={() => doReject(a.id)}>Reject</button>
                    </>
                  )}
                  {(a.status === 'approved' || a.status === 'rejected') && <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
              </tr>
            ))}
            {apps.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No applications yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
