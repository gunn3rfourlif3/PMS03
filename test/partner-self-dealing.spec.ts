import { selfDealingSignals } from '../src/modules/partners/self-dealing';

describe('self-dealing detection (§7.4)', () => {
  it('blocks when the partner is an owner of the referred agency', () => {
    const r = selfDealingSignals({
      partnerEmail: 'Thabo@Sizwe-Props.co.za',
      ownerEmails: ['thabo@sizwe-props.co.za'],
      vendorName: 'Sizwe Properties',
    });
    expect(r.signals).toContain('owner_email');
    expect(r.blocking).toBe(true);
  });

  it('finds nothing on an unrelated referral', () => {
    const r = selfDealingSignals({
      partnerEmail: 'nomsa@referrals.co.za',
      partnerName: 'Nomsa Dlamini',
      partnerCompany: 'Cape Referral Partners',
      ownerEmails: ['admin@harbourlets.co.za'],
      vendorName: 'Harbour Lets',
    });
    expect(r.signals).toEqual([]);
    expect(r.blocking).toBe(false);
  });

  describe('weaker signals flag but never block', () => {
    it('shared private mail domain', () => {
      const r = selfDealingSignals({
        partnerEmail: 'partner@sizwe-props.co.za',
        ownerEmails: ['ops@sizwe-props.co.za'],
        vendorName: 'Harbour Lets',
      });
      expect(r.signals).toEqual(['email_domain']);
      expect(r.blocking).toBe(false);
    });

    it('company name matching the agency', () => {
      const r = selfDealingSignals({
        partnerEmail: 'x@gmail.com',
        partnerCompany: 'Dantalan (Pty) Ltd',
        ownerEmails: ['owner@dantalan.co.za'],
        vendorName: 'Dantalan Properties',
      });
      expect(r.signals).toEqual(['name_match']);
      expect(r.blocking).toBe(false);
    });

    it('shared phone number across formats', () => {
      const r = selfDealingSignals({
        partnerEmail: 'a@gmail.com',
        partnerPhone: '+27 82 123 4567',
        ownerEmails: ['b@example.co.za'],
        ownerPhones: ['0821234567'],
        vendorName: 'Unrelated Agency',
      });
      expect(r.signals).toEqual(['phone_match']);
      expect(r.blocking).toBe(false);
    });
  });

  describe('false positives that would be unfair', () => {
    it('a shared Gmail host is not a signal', () => {
      const r = selfDealingSignals({
        partnerEmail: 'partner@gmail.com',
        ownerEmails: ['agency@gmail.com'],
        vendorName: 'Harbour Lets',
      });
      expect(r.signals).toEqual([]);
    });

    it('generic suffixes alone do not match two different agencies', () => {
      const r = selfDealingSignals({
        partnerCompany: 'Coastal Properties (Pty) Ltd',
        vendorName: 'Inland Properties',
      });
      expect(r.signals).toEqual([]);
    });

    it('a partial phone number is not enough', () => {
      const r = selfDealingSignals({
        partnerPhone: '1234',
        ownerPhones: ['0821231234'],
      });
      expect(r.signals).toEqual([]);
    });
  });

  it('reports every signal when several fire at once', () => {
    const r = selfDealingSignals({
      partnerEmail: 'thabo@sizwe-props.co.za',
      partnerPhone: '0821234567',
      partnerCompany: 'Sizwe Properties',
      ownerEmails: ['thabo@sizwe-props.co.za'],
      ownerPhones: ['+27821234567'],
      vendorName: 'Sizwe Properties',
    });
    expect(r.signals.sort()).toEqual(['name_match', 'owner_email', 'phone_match']);
    expect(r.blocking).toBe(true);
  });

  it('handles missing data without throwing', () => {
    expect(selfDealingSignals({})).toEqual({ signals: [], blocking: false });
    expect(selfDealingSignals({ partnerEmail: null, ownerEmails: [null, undefined] }).blocking).toBe(false);
  });
});
