'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Type, Phone, ImageIcon, Save, FileText, Upload, Trash2, ExternalLink } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { applyTheme } from '@/lib/branding';
import { GlassCard, PageHeader, Button, Field } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey } from '@shared/i18n';

/* `key` is the branding field name sent to the API; the label is now derived
   from it (`settings.color.<key>`) rather than carried alongside. */
const COLORS = [
  'brand', 'onBrand', 'accent', 'tint', 'ink', 'muted',
  'line', 'bg', 'card', 'danger', 'dangerBg', 'success',
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLocale();
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
    try { await api.setLeaseTemplate(tpl ?? ''); setTplMsg(t('settings.templateSaved')); }
    catch (e: any) { setErr(e.message); } finally { setTplBusy(false); }
  };
  const uploadLease = async (file?: File) => {
    if (!file) return;
    setLeaseBusy(true); setTplMsg(''); setErr('');
    try { const res = await api.uploadLeaseTemplateFile(file); setLeaseFileUrl(res.templateFileUrl); setTplMsg(t('settings.leaseUploaded')); }
    catch (e: any) { setErr(e.message); } finally { setLeaseBusy(false); if (leaseFileRef.current) leaseFileRef.current.value = ''; }
  };
  const removeLease = async () => {
    setLeaseBusy(true); setErr('');
    try { await api.clearLeaseTemplateFile(); setLeaseFileUrl(''); setTplMsg(t('settings.leaseRemoved')); }
    catch (e: any) { setErr(e.message); } finally { setLeaseBusy(false); }
  };

  if (!ready) return null;
  if (!b) return <div><PageHeader title={t('settings.title')} /><div className="rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err || t('settings.loadFailed')}</div></div>;

  const setColor = (k: string, v: string) => setB({ ...b, colors: { ...b.colors, [k]: v } });
  const setFont = (k: string, v: string) => setB({ ...b, font: { ...b.font, [k]: v } });
  const setContact = (k: string, v: string) => setB({ ...b, contact: { ...b.contact, [k]: v } });
  const setLogo = (k: string, v: string) => setB({ ...b, logo: { ...b.logo, [k]: v } });

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const updated = await api.updateBranding({ tagline: b.tagline, logo: b.logo, colors: b.colors, font: b.font, contact: b.contact });
      setB(updated); applyTheme(updated);
      setMsg(t('settings.saved'));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')}
        action={<Button onClick={save} loading={busy}><Save size={16} /> {t('settings.save')}</Button>} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {msg && <div className="mb-4 rounded-xl px-3 py-2 text-sm text-brand" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><ImageIcon size={18} /> {t('settings.identity')}</div>
          <div className="space-y-3">
            <Field label={t('settings.field.displayName')}><input className="input" value={b.logo?.text ?? ''} onChange={(e) => setLogo('text', e.target.value)} /></Field>
            <Field label={t('settings.field.tagline')}><input className="input" value={b.tagline ?? ''} onChange={(e) => setB({ ...b, tagline: e.target.value })} /></Field>
            <Field label={t('settings.field.logoUrl')}><input className="input" value={b.logo?.imageUrl ?? ''} onChange={(e) => setLogo('imageUrl', e.target.value)} placeholder="https://.../logo.png" /></Field>
            <Field label={t('settings.field.logoInverseUrl')}><input className="input" value={b.logo?.inverseUrl ?? ''} onChange={(e) => setLogo('inverseUrl', e.target.value)} placeholder="https://.../logo-dark.png" /></Field>
            <Field label={t('settings.field.markUrl')}><input className="input" value={b.logo?.markUrl ?? ''} onChange={(e) => setLogo('markUrl', e.target.value)} placeholder="https://.../mark.svg" /></Field>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Type size={18} /> {t('settings.typography')}</div>
          <div className="space-y-3">
            <Field label={t('settings.field.bodyFont')}><input className="input" value={b.font?.family ?? ''} onChange={(e) => setFont('family', e.target.value)} /></Field>
            <Field label={t('settings.field.headingFont')}><input className="input" value={b.font?.headingFamily ?? ''} onChange={(e) => setFont('headingFamily', e.target.value)} /></Field>
            <Field label={t('settings.field.webFontUrl')}><input className="input" value={b.font?.webUrl ?? ''} onChange={(e) => setFont('webUrl', e.target.value)} placeholder="https://fonts.googleapis.com/css2?family=Poppins..." /></Field>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-4">
        <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Palette size={18} /> {t('settings.colors')}</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map((key) => (
            <div key={key}>
              <span className="field-label">{t(`settings.color.${key}` as MessageKey)}</span>
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-11 cursor-pointer rounded-lg border border-line bg-transparent p-1" value={b.colors?.[key] ?? '#000000'} onChange={(e) => setColor(key, e.target.value)} />
                <input className="input" value={b.colors?.[key] ?? ''} onChange={(e) => setColor(key, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Phone size={18} /> {t('settings.contact')}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('settings.field.email')}><input className="input" value={b.contact?.email ?? ''} onChange={(e) => setContact('email', e.target.value)} /></Field>
          <Field label={t('settings.field.phone')}><input className="input" value={b.contact?.phone ?? ''} onChange={(e) => setContact('phone', e.target.value)} /></Field>
          <Field label={t('settings.field.website')}><input className="input" value={b.contact?.website ?? ''} onChange={(e) => setContact('website', e.target.value)} /></Field>
          <Field label={t('settings.field.address')}><input className="input" value={b.contact?.address ?? ''} onChange={(e) => setContact('address', e.target.value)} /></Field>
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="mb-1 flex items-center gap-2 font-heading text-lg font-bold"><FileText size={18} /> {t('settings.lease')}</div>
        <p className="mb-4 text-sm text-muted">{t('settings.leaseBlurb')}</p>
        {tplMsg && <div className="mb-3 rounded-xl px-3 py-2 text-sm text-brand" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>{tplMsg}</div>}

        <input ref={leaseFileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => uploadLease(e.target.files?.[0])} />

        {leaseFileUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-black/[0.03] px-4 py-3">
            <FileText size={20} className="text-brand" />
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">{t('settings.leaseIsUploaded')}</div>
              <a href={leaseFileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">{t('settings.viewCurrentLease')} <ExternalLink size={11} className="inline" /></a>
            </div>
            <Button variant="ghost" onClick={() => leaseFileRef.current?.click()} loading={leaseBusy}><Upload size={15} /> {t('settings.replace')}</Button>
            <Button variant="ghost" onClick={removeLease} loading={leaseBusy}><Trash2 size={15} /> {t('settings.remove')}</Button>
          </div>
        ) : (
          <Button onClick={() => leaseFileRef.current?.click()} loading={leaseBusy}><Upload size={16} /> {t('settings.uploadLease')}</Button>
        )}

        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">{t('settings.advancedSummary')}</summary>
          <div className="mt-3">
            {/* The placeholder tokens are literals the template engine matches,
                so they are passed in as values and never translated. */}
            <p className="mb-2 text-sm text-muted">{t('settings.advancedBlurb', { token: '{{tenant_name}}' })}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {placeholders.map((p) => <code key={p} className="rounded-md bg-black/[0.03] px-2 py-1 text-xs text-ink/70">{`{{${p}}}`}</code>)}
            </div>
            <textarea className="input min-h-[200px] font-mono text-[13px]" value={tpl ?? ''} onChange={(e) => setTpl(e.target.value)} placeholder={t('settings.templatePlaceholder', { token: '{{signature}}' })} />
            <div className="mt-3"><Button variant="ghost" onClick={saveTpl} loading={tplBusy}><Save size={15} /> {t('settings.saveTextTemplate')}</Button></div>
          </div>
        </details>
      </GlassCard>
    </div>
  );
}
