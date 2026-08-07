// MediaService pulls in `sharp`, whose native binary is platform-specific and
// isn't exercised here (uploads are mocked), so stub it to keep this suite
// runnable on any OS.
jest.mock('sharp', () => ({ __esModule: true, default: jest.fn() }));

import { PartnerApplicationsService } from '@modules/partner-applications/partner-applications.service';

/**
 * #212 — the critical path is approve(): it must provision a real partner + login
 * exactly once, be idempotent, and refuse a rejected application. The repo, media,
 * partners service and KYC provider are mocked.
 */
function makeSvc(app: any, opts: { due?: any[] } = {}) {
  const qb: any = {
    where: jest.fn(() => qb), andWhere: jest.fn(() => qb), select: jest.fn(() => qb),
    orderBy: jest.fn(() => qb), take: jest.fn(() => qb),
    getMany: jest.fn(async () => opts.due ?? []),
  };
  const repo = {
    findOne: jest.fn(async () => app),
    save: jest.fn(async (a: any) => a),
    create: jest.fn((a: any) => a),
    createQueryBuilder: jest.fn(() => qb),
  };
  const query = jest.fn(async () => [{ id: 'x1' }]);
  const ds: any = { getRepository: () => repo, query };
  const media: any = { saveProof: jest.fn() };
  const partners: any = {
    createPartner: jest.fn(async () => ({ id: 'p1' })),
    addMember: jest.fn(async () => ({ ok: true })),
  };
  const kyc: any = { name: 'manual', verifyIndividual: jest.fn(), verifyBusiness: jest.fn() };
  // Capture outbound email so we can assert on the applicant-facing links.
  const sent: any[] = [];
  const channels = new Map<string, any>([
    ['email', { send: jest.fn(async (m: any) => { sent.push(m); return { ok: true }; }) }],
  ]);
  const svc = new PartnerApplicationsService(ds, media, partners, kyc, channels as any);
  return { svc, repo, partners, query, sent, qb };
}

describe('PartnerApplicationsService.approve', () => {
  it('provisions a partner + login and marks the application approved', async () => {
    const app: any = { id: 'a1', type: 'individual', status: 'submitted', contactEmail: 'v@x.com', fullName: 'Vee', contactPhone: '+27820000000' };
    const { svc, partners } = makeSvc(app);
    const r = await svc.approve('a1', 'admin1', { commissionRate: 0.2, commissionMonths: null });
    expect(r).toEqual({ partnerId: 'p1' });
    expect(partners.createPartner).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vee', contactEmail: 'v@x.com', commissionRate: 0.2 }));
    expect(partners.addMember).toHaveBeenCalledWith('p1', 'v@x.com', 'Vee');
    expect(app.status).toBe('approved');
    expect(app.partnerId).toBe('p1');
  });

  it('is idempotent when already approved (no second partner)', async () => {
    const app: any = { id: 'a1', type: 'business', status: 'approved', partnerId: 'p9', companyName: 'Acme' };
    const { svc, partners } = makeSvc(app);
    const r = await svc.approve('a1', 'admin1', {});
    expect(r).toEqual({ partnerId: 'p9' });
    expect(partners.createPartner).not.toHaveBeenCalled();
  });

  it('refuses to approve a rejected application', async () => {
    const app: any = { id: 'a1', type: 'individual', status: 'rejected' };
    const { svc } = makeSvc(app);
    await expect(svc.approve('a1', 'admin1', {})).rejects.toThrow(/rejected/i);
  });
});

describe('PartnerApplicationsService — two-stage application', () => {
  it('stage 1 stores contact only, emails a continue link, and returns no token', async () => {
    const { svc, sent } = makeSvc(null);
    const r = await svc.start({ contactName: 'Vee Jones', contactEmail: ' V@X.com ', contactPhone: '0820000000' });

    expect(r.emailed).toBe(true);
    // The token must never reach the browser — it only travels by email, which
    // is what verifies the address before we collect any PII.
    expect((r as any).uploadToken).toBeUndefined();

    const toApplicant = sent.find((m) => m.to === 'v@x.com');
    expect(toApplicant).toBeDefined();
    expect(toApplicant.body).toMatch(/\/partner-apply\/continue\?id=.*&token=/);
    // …and the team is told a lead came in.
    expect(sent.some((m) => /partner enquiry/i.test(m.subject))).toBe(true);
  });

  it('reuses an open draft instead of creating a duplicate lead', async () => {
    const existing: any = { id: 'a1', contactEmail: 'v@x.com', status: 'started' };
    const { svc, repo, sent } = makeSvc(existing);
    (repo.findOne as jest.Mock).mockResolvedValueOnce(existing);

    const r = await svc.start({ contactEmail: 'v@x.com' });
    expect(r.id).toBe('a1');
    expect(repo.create).not.toHaveBeenCalled();
    // No second "new enquiry" alert for a repeat submission.
    expect(sent.some((m) => /partner enquiry/i.test(m.subject))).toBe(false);
  });

  it('stage 2 saves details, merges PII, and promotes the lead to draft', async () => {
    const token = 'tok';
    const app: any = {
      id: 'a1', status: 'started', contactEmail: 'v@x.com',
      sensitive: { dob: '1990-01-01' }, banking: { bankName: 'FNB' }, documents: [],
      uploadTokenHash: require('node:crypto').createHash('sha256').update(token).digest('hex'),
      uploadTokenExpires: new Date(Date.now() + 60_000),
    };
    const { svc } = makeSvc(app);
    const r = await svc.saveDetails('a1', token, { type: 'individual', fullName: 'Vee', idNumber: '9001015800080' });

    expect(r.status).toBe('draft');
    expect(app.fullName).toBe('Vee');
    // Earlier PII survives a later partial save.
    expect(app.sensitive).toEqual({ dob: '1990-01-01', idNumber: '9001015800080' });
    expect(app.banking).toEqual({ bankName: 'FNB' });
  });

  it('rejects stage-2 access with a bad token', async () => {
    const app: any = {
      id: 'a1', status: 'started',
      uploadTokenHash: 'somethingelse', uploadTokenExpires: new Date(Date.now() + 60_000),
    };
    const { svc } = makeSvc(app);
    await expect(svc.resume('a1', 'wrong')).rejects.toThrow(/invalid/i);
  });

  it('rejects stage-2 access once the link has expired', async () => {
    const token = 'tok';
    const app: any = {
      id: 'a1', status: 'started',
      uploadTokenHash: require('node:crypto').createHash('sha256').update(token).digest('hex'),
      uploadTokenExpires: new Date(Date.now() - 1000),
    };
    const { svc } = makeSvc(app);
    await expect(svc.resume('a1', token)).rejects.toThrow(/expired/i);
  });

  it('reminds unfinished applicants once, with a fresh link', async () => {
    const due: any = { id: 'a1', contactEmail: 'v@x.com', status: 'started', contactName: 'Vee' };
    const { svc, sent } = makeSvc(null, { due: [due] });

    const r = await svc.sendReminders(48);
    expect(r).toEqual({ sent: 1 });
    expect(due.reminderSentAt).toBeInstanceOf(Date); // marks it so it never repeats
    expect(due.uploadTokenHash).toBeTruthy();        // fresh token issued
    expect(sent[0].to).toBe('v@x.com');
    expect(sent[0].body).toMatch(/\/partner-apply\/continue\?id=/);
  });
});

describe('PartnerApplicationsService.purgeRejectedDocuments', () => {
  it('clears PII from old rejected rows and reports the count', async () => {
    const { svc, query } = makeSvc({});
    const r = await svc.purgeRejectedDocuments(90);
    expect(r).toEqual({ purged: 1 });
    const sql = (query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toMatch(/UPDATE partner_applications/i);
    expect(sql).toMatch(/status = 'rejected'/);
    expect(sql).toMatch(/documents <> '\[\]'::jsonb/);
  });
});
