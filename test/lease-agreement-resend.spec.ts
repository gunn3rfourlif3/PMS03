import { InternalServerErrorException } from '@nestjs/common';
import { LeaseAgreementService } from '../src/modules/lease-agreement/lease-agreement.service';

/**
 * `resendSigningLink` is the only unauthenticated write-ish path in this module,
 * so its contract is worth pinning down precisely:
 *
 *  - it never reveals whether a destination belongs to a real account;
 *  - it resends the EXISTING ref and never generates a new agreement;
 *  - it mails the address on the user record, never the one in the request;
 *  - "nothing to resend" is a quiet success, but a real fault is a 500, because
 *    telling a tenant their link was sent when it was not is worse than an error.
 *
 * Built with hand-rolled doubles rather than a Nest testing module: the service
 * needs only four collaborators and the SQL is matched by shape, which keeps the
 * suite out of the DB and fast.
 */

type QueryFn = (sql: string, params?: any[]) => Promise<any[]>;

const USER = { id: 'u-1', name: 'Thandeka Mbeki', email: 'thandeka@example.com' };

function build(opts: {
  user?: Record<string, any> | null;
  pending?: { vendorId: string; ref: string } | null;
  vendorRow?: Record<string, any>;
  emailOk?: boolean;
  onLookup?: QueryFn;
} = {}) {
  const sent: Array<{ to: string; subject: string; body: string; html?: string }> = [];

  const ds = {
    query: (async (sql: string, params?: any[]) => {
      if (opts.onLookup) {
        const r = await opts.onLookup(sql, params);
        if (r) return r;
      }
      if (/FROM users WHERE/i.test(sql)) return opts.user === null ? [] : [opts.user ?? USER];
      if (/auth_pending_signing_link/i.test(sql)) {
        return [{ d: opts.pending === null ? null : (opts.pending ?? { vendorId: 'v-1', ref: 'las_existing' }) }];
      }
      return [];
    }) as QueryFn,
  };

  const tenant = {
    vendorId: 'v-1',
    getManager: () => ({
      query: async (sql: string) =>
        /FROM vendors/i.test(sql) ? [opts.vendorRow ?? { name: 'Harbourline Rentals', config: {} }] : [],
    }),
    getRepository: () => ({ findOne: async () => null, save: async (x: any) => x, create: (x: any) => x }),
  };

  const tenantRunner = { runInVendorContext: async (_v: string, fn: () => Promise<any>) => fn() };

  const channels = new Map<string, any>([
    ['email', {
      send: async (m: any) => {
        if (opts.emailOk === false) return { ok: false, error: 'provider down' };
        sent.push(m);
        return { ok: true };
      },
    }],
  ]);

  const media = { saveHtml: async () => ({ url: 'https://example.test/doc.html' }) };

  const svc = new LeaseAgreementService(
    tenant as any, tenantRunner as any, ds as any, media as any, channels as any,
  );
  return { svc, sent, ds };
}

describe('resendSigningLink', () => {
  it('reports success for an address it has never seen', async () => {
    const { svc, sent } = build({ user: null });
    await expect(svc.resendSigningLink('nobody@example.com')).resolves.toEqual({ ok: true });
    // The identical answer is the whole point: this must not be an oracle for
    // whether an account exists.
    expect(sent).toHaveLength(0);
  });

  it('reports success when the user exists but has nothing to sign', async () => {
    const { svc, sent } = build({ pending: null });
    await expect(svc.resendSigningLink(USER.email)).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('is a no-op for a blank destination', async () => {
    const { svc, sent } = build();
    await expect(svc.resendSigningLink('   ')).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('resends the existing ref rather than minting a new one', async () => {
    const { svc, sent } = build({ pending: { vendorId: 'v-1', ref: 'las_existing' } });
    await svc.resendSigningLink(USER.email);
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toContain('las_existing');
    // A new ref would invalidate every link already in the tenant's inbox.
    expect(sent[0].body).not.toMatch(/las_(?!existing)/);
  });

  it('mails the address on the user record, not the one supplied', async () => {
    const { svc, sent } = build();
    // An attacker supplying a known tenant's phone number must not be able to
    // steer the link to an address of their choosing.
    await svc.resendSigningLink('+27821234567');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(USER.email);
  });

  it('does not mail a user with no email on record', async () => {
    const { svc, sent } = build({ user: { ...USER, email: null } });
    await expect(svc.resendSigningLink(USER.email)).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('carries the agency name into the email', async () => {
    const { svc, sent } = build({ vendorRow: { name: 'Kalk Bay Letting', config: {} } });
    await svc.resendSigningLink(USER.email);
    expect(sent[0].subject).toContain('Kalk Bay Letting');
  });

  it('fails loudly when the lookup is broken', async () => {
    // The case that motivated this: the migration had not run, so the function
    // did not exist. Previously the tenant was told "sent" and nothing happened.
    const { svc } = build({
      onLookup: async (sql) => {
        if (/auth_pending_signing_link/i.test(sql)) throw new Error('function does not exist');
        return null as any;
      },
    });
    await expect(svc.resendSigningLink(USER.email)).rejects.toThrow(InternalServerErrorException);
  });

  it('fails loudly when delivery fails', async () => {
    const { svc } = build({ emailOk: false });
    await expect(svc.resendSigningLink(USER.email)).rejects.toThrow(InternalServerErrorException);
  });

  it('does not leak the reason for a failure', async () => {
    const { svc } = build({ emailOk: false });
    await expect(svc.resendSigningLink(USER.email)).rejects.toThrow(/could not resend your signing link/i);
  });
});
