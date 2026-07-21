'use client';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useBrand } from './brand-provider';

type Variant = 'success' | 'failed' | 'cancelled';

const CONFIG: Record<Variant, { icon: any; color: string; title: string; body: string }> = {
  success:   { icon: CheckCircle2, color: 'var(--success)', title: 'Payment received',  body: 'Thanks — your payment was successful. Your account will update shortly. You can close this window and return to the app.' },
  failed:    { icon: XCircle,      color: 'var(--danger)',  title: 'Payment failed',    body: "Your payment didn't go through and you have not been charged. Please head back to the app and try again." },
  cancelled: { icon: MinusCircle,  color: 'var(--muted)',   title: 'Payment cancelled', body: 'You cancelled the payment and have not been charged. You can return to the app and try again whenever you like.' },
};

/** Public landing page shown after an iKhokha redirect (success / failed / cancelled). */
export default function PayResult({ variant }: { variant: Variant }) {
  const b = useBrand();
  const { icon: Icon, color, title, body } = CONFIG[variant];
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center animate-fade-up">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          {b.logo.imageUrl
            ? <img src={b.logo.imageUrl} alt="" className="h-9 w-9 rounded-xl object-contain" />
            : <span className="grid h-9 w-9 place-items-center rounded-xl font-heading font-bold text-onbrand"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 88%, white), var(--brand))' }}>
                {b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
              </span>}
          <span className="font-heading text-lg font-bold text-ink">{b.logo.text}</span>
        </div>
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
          <Icon size={34} />
        </span>
        <h1 className="font-heading text-2xl font-bold text-ink">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
        <p className="mt-6 text-xs text-muted">You can safely close this window.</p>
      </div>
    </div>
  );
}
