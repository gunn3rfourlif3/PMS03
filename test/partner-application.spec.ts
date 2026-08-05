import { PartnerApplicationsService } from '@modules/partner-applications/partner-applications.service';

/**
 * #212 — the critical path is approve(): it must provision a real partner + login
 * exactly once, be idempotent, and refuse a rejected application. The repo, media,
 * partners service and KYC provider are mocked.
 */
function makeSvc(app: any) {
  const repo = {
    findOne: jest.fn(async () => app),
    save: jest.fn(async (a: any) => a),
    create: jest.fn((a: any) => a),
    createQueryBuilder: jest.fn(),
  };
  const ds: any = { getRepository: () => repo };
  const media: any = { saveProof: jest.fn() };
  const partners: any = {
    createPartner: jest.fn(async () => ({ id: 'p1' })),
    addMember: jest.fn(async () => ({ ok: true })),
  };
  const kyc: any = { name: 'manual', verifyIndividual: jest.fn(), verifyBusiness: jest.fn() };
  const svc = new PartnerApplicationsService(ds, media, partners, kyc, undefined);
  return { svc, repo, partners };
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
