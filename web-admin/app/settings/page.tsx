'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Type, Phone, ImageIcon, Save, FileText } from 'lucide-react';
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

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    api.brandingSettings().then((res) => { setB(res); setReady(true); }).catch((e) => { setErr(e.message); setReady(true); });
    api.getLeaseTemplate().then((res) => { setTpl(res.template ?? ''); setPlaceholders(res.placeholders ?? []); }).catch(() => setTpl(''));
  }, []);

  const saveTpl = async () => {
    setTplBusy(true); setTplMsg(''); setErr('');
    try { await api.setLeaseTemplate(tpl ?? ''); setTplMsg('Lease template saved — new lease agreements will use it.'); }
    catch (e: any) { setErr(e.message); } finally { setTplBusy(false); }
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
        <div className="mb-1 flex items-center gap-2 font-heading text-lg font-bold"><FileText size={18} /> Lease agreement template</div>
        <p className="mb-3 text-sm text-muted">
          Paste your own lease agreement (plain text or HTML). Use placeholders like <code className="rounded bg-white/50 px-1">{'{{tenant_name}}'}</code> and they’ll be filled in automatically when a lease is generated on approval. Leave blank to use the built-in South African starter template.
        </p>
        {tplMsg && <div className="mb-3 rounded-xl px-3 py-2 text-sm text-brand" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>{tplMsg}</div>}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {placeholders.map((p) => <code key={p} className="rounded-md bg-white/50 px-2 py-1 text-xs text-ink/70">{`{{${p}}}`}</code>)}
        </div>
        <textarea className="input min-h-[260px] font-mono text-[13px]" value={tpl ?? ''} onChange={(e) => setTpl(e.target.value)}
          placeholder="Paste your lease agreement here. Include {{signature}} where the electronic signature block should appear (otherwise it's added at the end)." />
        <div className="mt-3"><Button onClick={saveTpl} loading={tplBusy}><Save size={16} /> Save template</Button></div>
      </GlassCard>
    </div>
  );
}
