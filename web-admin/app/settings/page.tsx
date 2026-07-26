'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Type, Phone, ImageIcon, Save, FileText, Upload, Trash2, ExternalLink } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { applyTheme } from '@/lib/branding';
import { GlassCard, PageHeader, Button, Field } from '@/components/ui';

const COLORS: { key: string; label: string }[] = [
  { key: 'brand', label: 'Primary' }, { key: 'onBrand', label: 'On primary' }, { key: 'accent', label: 'Accent' },
  { key: 'tint', label: 'Tint' }, { key: 'ink', label: 'Text' }, { key: 'muted', label: 'Muted text' },
  { key: 'line', label: 'Borders' }, { key: 'bg', label: 'Background' }, { key: 'card', label: 'Card' },
  { key: 'danger', label: 'Danger' }, { key: 'dangerBg', label: 'Danger bg' }, { key: 'success', label: 'Success' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState('');
  const [leaseFileUrl, setLeaseFileUrl] = useState('');
  const [leaseBusy, setLeaseBusy] = useState(false);
  const leaseFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    api.brandingSettings().then((res) => { setB(res); setReady(true); }).catch((e) => { setErr(e.message); setReady(true); });
    api.getLeaseTemplate().then((res) => { setTpl(res.template ?? ''); setPlaceholders(res.placeholders ?? []); setLeaseFileUrl(res.templateFileUrl ?? ''); }).catch(() => setTpl(''));
  }, []);

  const saveTpl = async () => {
    setTplBusy(true); setTplMsg(''); setErr('');
    try { await api.setLeaseTemplate(tpl ?? ''); setTplMsg('Advanced template saved.'); }
    catch (e: any) { setErr(e.message); } finally { setTplBusy(false); }
  };
  const uploadLease = async (file?: File) => {
    if (!file) return;
    setLeaseBusy(true); setTplMsg(''); setErr('');
    try { const res = await api.uploadLeaseTemplateFile(file); setLeaseFileUrl(res.templateFileUrl); setTplMsg('Lease uploaded — new tenants will be sent this to sign.'); }
    catch (e: any) { setErr(e.message); } finally { setLeaseBusy(false); if (leaseFileRef.current) leaseFileRef.current.value = ''; }
  };
  const removeLease = async () => {
    setLeaseBusy(true); setErr('');
    try { await api.clearLeaseTemplateFile(); setLeaseFileUrl(''); setTplMsg('Lease removed — the built-in starter will be used until you upload one.'); }
    catch (e: any) { setErr(e.message); } finally { setLeaseBusy(false); }
  };

  if (!ready) return null;
  if (!b) return <div><PageHeader title="Branding" /><div className="rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err || 'Could not load branding.'}</div></div>;

  const setColor = (k: string, v: string) => setB({ ...b, colors: { ...b.colors, [k]: v } });
  const setFont = (k: string, v: string) => setB({ ...b, font: { ...b.font, [k]: v } });
  const setContact = (k: string, v: string) => setB({ ...b, contact: { ...b.contact, [k]: v } });
  const setLogo = (k: string, v: string) => setB({ ...b, logo: { ...b.logo, [k]: v } });

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const updated = await api.updateBranding({ tagline: b.tagline, logo: b.logo, colors: b.colors, font: b.font, contact: b.contact });
      setB(updated); applyTheme(updated);
      setMsg('Saved. This console re-themed instantly; mobile apps update on next reload.');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Branding" subtitle="Your white-label theme — applies to every app that loads your brand"
        action={<Button onClick={save} loading={busy}><Save size={16} /> Save branding</Button>} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {msg && <div className="mb-4 rounded-xl px-3 py-2 text-sm text-brand" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><ImageIcon size={18} /> Identity</div>
          <div className="space-y-3">
            <Field label="Display name"><input className="input" value={b.logo?.text ?? ''} onChange={(e) => setLogo('text', e.target.value)} /></Field>
            <Field label="Tagline"><input className="input" value={b.tagline ?? ''} onChange={(e) => setB({ ...b, tagline: e.target.value })} /></Field>
            <Field label="Logo image URL (optional — falls back to a lettered tile)"><input className="input" value={b.logo?.imageUrl ?? ''} onChange={(e) => setLogo('imageUrl', e.target.value)} placeholder="https://.../logo.png" /></Field>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Type size={18} /> Typography</div>
          <div className="space-y-3">
            <Field label="Body font family (e.g. Poppins, or System)"><input className="input" value={b.font?.family ?? ''} onChange={(e) => setFont('family', e.target.value)} /></Field>
            <Field label="Heading font family"><input className="input" value={b.font?.headingFamily ?? ''} onChange={(e) => setFont('headingFamily', e.target.value)} /></Field>
            <Field label="Web font stylesheet URL (Google Fonts, optional)"><input className="input" value={b.font?.webUrl ?? ''} onChange={(e) => setFont('webUrl', e.target.value)} placeholder="https://fonts.googleapis.com/css2?family=Poppins..." /></Field>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-4">
        <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Palette size={18} /> Colors</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map(({ key, label }) => (
            <div key={key}>
              <span className="field-label">{label}</span>
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-11 cursor-pointer rounded-lg border border-line bg-transparent p-1" value={b.colors?.[key] ?? '#000000'} onChange={(e) => setColor(key, e.target.value)} />
                <input className="input" value={b.colors?.[key] ?? ''} onChange={(e) => setColor(key, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Phone size={18} /> Contact</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email"><input className="input" value={b.contact?.email ?? ''} onChange={(e) => setContact('email', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={b.contact?.phone ?? ''} onChange={(e) => setContact('phone', e.target.value)} /></Field>
          <Field label="Website"><input className="input" value={b.contact?.website ?? ''} onChange={(e) => setContact('website', e.target.value)} /></Field>
          <Field label="Address"><input className="input" value={b.contact?.address ?? ''} onChange={(e) => setContact('address', e.target.value)} /></Field>
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="mb-1 flex items-center gap-2 font-heading text-lg font-bold"><FileText size={18} /> Lease agreement</div>
        <p className="mb-4 text-sm text-muted">
          Upload your own lease agreement (PDF). When you approve a tenant, we automatically prepare a signing packet — a schedule with their details (name, unit, rent, deposit, dates) plus your lease — and email them a link to sign. No editing needed.
        </p>
        {tplMsg && <div className="mb-3 rounded-xl px-3 py-2 text-sm text-brand" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>{tplMsg}</div>}

        <input ref={leaseFileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => uploadLease(e.target.files?.[0])} />

        {leaseFileUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/50 bg-white/40 px-4 py-3">
            <FileText size={20} className="text-brand" />
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">Your lease is uploaded</div>
              <a href={leaseFileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">View current lease <ExternalLink size={11} className="inline" /></a>
            </div>
            <Button variant="ghost" onClick={() => leaseFileRef.current?.click()} loading={leaseBusy}><Upload size={15} /> Replace</Button>
            <Button variant="ghost" onClick={removeLease} loading={leaseBusy}><Trash2 size={15} /> Remove</Button>
          </div>
        ) : (
          <Button onClick={() => leaseFileRef.current?.click()} loading={leaseBusy}><Upload size={16} /> Upload lease (PDF)</Button>
        )}

        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">Advanced: use a text template with placeholders instead</summary>
          <div className="mt-3">
            <p className="mb-2 text-sm text-muted">Paste plain text or HTML with placeholders like <code className="rounded bg-white/50 px-1">{'{{tenant_name}}'}</code>. Only used when no lease file is uploaded above.</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {placeholders.map((p) => <code key={p} className="rounded-md bg-white/50 px-2 py-1 text-xs text-ink/70">{`{{${p}}}`}</code>)}
            </div>
            <textarea className="input min-h-[200px] font-mono text-[13px]" value={tpl ?? ''} onChange={(e) => setTpl(e.target.value)} placeholder="Optional. Include {{signature}} where the signature block should appear." />
            <div className="mt-3"><Button variant="ghost" onClick={saveTpl} loading={tplBusy}><Save size={15} /> Save text template</Button></div>
          </div>
        </details>
      </GlassCard>
    </div>
  );
}
