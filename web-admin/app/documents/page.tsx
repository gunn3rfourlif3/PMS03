'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, PenLine } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal } from '@/components/ui';

export default function DocumentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [leases, setLeases] = useState<any[]>([]);
  const [leaseId, setLeaseId] = useState('');
  const [docs, setDocs] = useState<any[]>([]);
  const [type, setType] = useState('lease_agreement');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [signFor, setSignFor] = useState<string | null>(null);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.rentRoll().then((rr) => { setLeases(rr); if (rr[0]) { setLeaseId(rr[0].lease_id); loadDocs(rr[0].lease_id); } }).catch((e) => setErr(e.message));
  }, []);

  const loadDocs = async (id: string) => {
    setErr('');
    try { setDocs(await api.listDocuments('lease', id)); } catch (e: any) { setErr(e.message); }
  };
  const onLease = (id: string) => { setLeaseId(id); loadDocs(id); };

  const add = async () => {
    if (!leaseId) return;
    setBusy(true); setErr(''); setMsg('');
    const file = fileRef.current?.files?.[0];
    const filename = file?.name ?? `${type}.pdf`;
    const contentType = file?.type || 'application/pdf';
    try {
      const { documentId, uploadUrl } = await api.docUploadUrl({ ownerType: 'lease', ownerId: leaseId, type, filename, contentType });
      if (file && uploadUrl) {
        // In production this PUTs straight to object storage. The dev local driver
        // may not accept the PUT — we tolerate that and still register the doc.
        try { await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file }); } catch { /* dev stub */ }
      }
      await api.docConfirm(documentId);
      if (fileRef.current) fileRef.current.value = '';
      setMsg('Document registered.');
      await loadDocs(leaseId);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const download = async (id: string) => {
    setErr('');
    try { const url = await api.docDownloadUrl(id); window.open(url as any, '_blank'); }
    catch (e: any) { setErr(e.message); }
  };
  const openSign = (id: string) => { setSignerEmail(''); setSignerName(''); setSignFor(id); };
  const sign = async () => {
    if (!signFor || !signerEmail) return;
    setErr(''); setMsg(''); setBusy(true);
    try {
      const r = await api.requestSignature(signFor, signerEmail, signerName || undefined);
      setSignFor(null);
      setMsg(`Signature requested — signing link: ${r.signUrl}`);
      await loadDocs(leaseId);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Documents" subtitle="Lease documents, uploads, and e-signature" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {msg && <div className="mb-4 break-words rounded-xl px-3 py-2 text-sm text-brand" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>{msg}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">Add document</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Field label="Lease">
              <select className="input" value={leaseId} onChange={(e) => onLease(e.target.value)}>
                {leases.length === 0 && <option value="">No active leases</option>}
                {leases.map((l) => <option key={l.lease_id} value={l.lease_id}>{l.unit}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-48"><Field label="Type"><input className="input" value={type} onChange={(e) => setType(e.target.value)} /></Field></div>
          <div className="w-56"><Field label="File (optional in dev)"><input ref={fileRef} type="file" className="input !py-2" /></Field></div>
          <Button onClick={add} loading={busy} disabled={!leaseId}><Upload size={16} /> Add</Button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-lg font-bold">Documents</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">File</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Ver</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium">{d.filename}</td>
                  <td className="px-5 py-3 text-muted">{d.type}</td>
                  <td className="px-5 py-3">v{d.version}</td>
                  <td className="px-5 py-3"><Badge tone={d.status === 'stored' ? 'success' : 'muted'}>{d.status}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => download(d.id)}><Download size={15} /> Download</Button>
                      <Button variant="ghost" onClick={() => openSign(d.id)}><PenLine size={15} /> Send to sign</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={5}><EmptyState>No documents for this lease yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={!!signFor} onClose={() => setSignFor(null)} title="Send for e-signature"
        footer={<>
          <Button variant="ghost" onClick={() => setSignFor(null)} disabled={busy}>Cancel</Button>
          <Button onClick={sign} loading={busy} disabled={!signerEmail}><PenLine size={15} /> Request signature</Button>
        </>}>
        <div className="space-y-4">
          <Field label="Signer email"><input className="input" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="tenant@example.com" /></Field>
          <Field label="Signer name (optional)"><input className="input" value={signerName} onChange={(e) => setSignerName(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
