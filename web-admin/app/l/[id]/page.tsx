'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, thumbUrl } from '@/lib/api';
import { GlassCard, Button, Field, Badge, money } from '@/components/ui';
import { PublicHeader, PublicFooter, formatAddress, formatDate } from '@/components/public-chrome';

const EMPLOYMENT = ['Employed', 'Self-employed', 'Contract', 'Student', 'Unemployed', 'Retired'];

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [l, setL] = useState<any | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Applicant fields
  const [f, setF] = useState({
    name: '', email: '', phone: '', idNumber: '', dob: '', currentAddress: '',
    employmentStatus: '', employer: '', monthlyIncome: '', occupants: '1',
    moveInDate: '', pets: 'no', petDetails: '', message: '', consent: false,
  });
  const set = (k: keyof typeof f) => (v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api.publicListing(id).then(setL).catch((e) => setLoadErr(e.message));
  }, [id]);

  // Age gate: applicants must be 18+ (checked here and re-checked server-side).
  const age = (() => {
    if (!f.dob) return null;
    const d = new Date(f.dob);
    if (isNaN(d.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a -= 1;
    return a;
  })();
  const underage = age !== null && age < 18;

  const canSubmit =
    f.name.trim() && f.email.trim() && f.phone.trim() && f.idNumber.trim() &&
    f.dob && !underage &&
    f.monthlyIncome.trim() && f.moveInDate && f.consent;

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await api.applyToListing({
        listingId: id,
        applicantName: f.name.trim(),
        applicantEmail: f.email.trim(),
        applicantPhone: f.phone.trim(),
        details: {
          idNumber: f.idNumber.trim(),
          dateOfBirth: f.dob || undefined,
          currentAddress: f.currentAddress.trim() || undefined,
          employmentStatus: f.employmentStatus || undefined,
          employer: f.employer.trim() || undefined,
          monthlyIncome: Number(f.monthlyIncome) || undefined,
          occupants: Number(f.occupants) || undefined,
          moveInDate: f.moveInDate,
          pets: f.pets === 'yes',
          petDetails: f.pets === 'yes' ? (f.petDetails.trim() || undefined) : undefined,
          message: f.message.trim() || undefined,
          consent: true,
          consentAt: new Date().toISOString(),
        },
      });
      setDone(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/rentals" className="text-sm text-muted hover:text-brand">&larr; All rentals</Link>

        {loadErr && <div className="mt-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{loadErr}</div>}

        {l && (
          <>
            <GlassCard className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-heading text-2xl font-bold text-ink">{l.propertyName}</h1>
                  <div className="text-sm text-muted">{l.unitLabel}{formatAddress(l.address) ? ` · ${formatAddress(l.address)}` : ''}</div>
                </div>
                <Badge tone="success">Available</Badge>
              </div>
              <div className="mt-4 text-3xl font-bold text-brand">{money(l.rent)}<span className="text-base font-normal text-muted">/month</span></div>
              <div className="mt-1 text-sm text-muted">{l.bedrooms} bed · {l.bathrooms} bath{l.sizeSqm ? ` · ${l.sizeSqm} m²` : ''} · available from {formatDate(l.availableFrom)}</div>
              {l.description && <p className="mt-4 whitespace-pre-line text-sm text-ink/80">{l.description}</p>}
              {Array.isArray(l.media) && l.media.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {l.media.map((url: string) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={thumbUrl(url)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = url; }} alt="" className="aspect-[4/3] w-full rounded-xl object-cover transition hover:opacity-90" />
                    </a>
                  ))}
                </div>
              )}
            </GlassCard>

            {done ? (
              <GlassCard className="mt-6 text-center">
                <div className="font-heading text-xl font-bold text-ink">Application received 🎉</div>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Thanks, {f.name.split(' ')[0] || 'there'}. We’ve received your application for {l.propertyName} and will be in touch soon on {f.email}.
                </p>
                <div className="mt-4"><Link href="/rentals"><Button variant="ghost">Browse more rentals</Button></Link></div>
              </GlassCard>
            ) : (
              <GlassCard className="mt-6">
                <div className="font-heading text-lg font-bold text-ink">Apply for this rental</div>
                <p className="mb-4 text-sm text-muted">Fields marked * are required.</p>
                {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name *"><input className="input" value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field>
                  <Field label="ID / passport number *"><input className="input" value={f.idNumber} onChange={(e) => set('idNumber')(e.target.value)} /></Field>
                  <Field label="Email *"><input className="input" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} /></Field>
                  <Field label="Mobile number *"><input className="input" value={f.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="+27…" /></Field>
                  <Field label="Date of birth *">
                    <input className="input" type="date" value={f.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('dob')(e.target.value)} />
                    {underage && <p className="mt-1 text-sm text-danger">You must be at least 18 years old to apply.</p>}
                  </Field>
                  <Field label="Preferred move-in date *"><input className="input" type="date" value={f.moveInDate} onChange={(e) => set('moveInDate')(e.target.value)} /></Field>
                  <div className="sm:col-span-2"><Field label="Current residential address"><input className="input" value={f.currentAddress} onChange={(e) => set('currentAddress')(e.target.value)} /></Field></div>
                  <Field label="Employment status">
                    <select className="input" value={f.employmentStatus} onChange={(e) => set('employmentStatus')(e.target.value)}>
                      <option value="">Select…</option>
                      {EMPLOYMENT.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </Field>
                  <Field label="Employer / business"><input className="input" value={f.employer} onChange={(e) => set('employer')(e.target.value)} /></Field>
                  <Field label="Gross monthly income (R) *"><input className="input" inputMode="numeric" value={f.monthlyIncome} onChange={(e) => set('monthlyIncome')(e.target.value)} placeholder="25000" /></Field>
                  <Field label="Number of occupants"><input className="input" inputMode="numeric" value={f.occupants} onChange={(e) => set('occupants')(e.target.value)} /></Field>
                  <Field label="Any pets?">
                    <select className="input" value={f.pets} onChange={(e) => set('pets')(e.target.value)}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                  {f.pets === 'yes' && <Field label="Pet details"><input className="input" value={f.petDetails} onChange={(e) => set('petDetails')(e.target.value)} placeholder="e.g. 1 small dog" /></Field>}
                  <div className="sm:col-span-2"><Field label="Anything else we should know?"><textarea className="input min-h-[90px]" value={f.message} onChange={(e) => set('message')(e.target.value)} /></Field></div>
                </div>

                <label className="mt-4 flex items-start gap-2 text-sm text-ink/80">
                  <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set('consent')(e.target.checked)} />
                  <span>I confirm the information above is accurate and I consent to affordability, credit and background checks and to my personal information being processed for this rental application (POPIA). *</span>
                </label>

                <Button className="mt-5 w-full" onClick={submit} loading={busy} disabled={!canSubmit}>Submit application</Button>
              </GlassCard>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
