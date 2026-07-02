import { collectionRate, agingBucket } from '../src/modules/reporting/reporting-calc';

describe('reporting calc', () => {
  it('computes collection rate as a percentage', () => {
    expect(collectionRate(9200, 9200)).toBe(100);
    expect(collectionRate(10000, 7500)).toBe(75);
    expect(collectionRate(0, 0)).toBe(0);
  });
  it('buckets arrears by age', () => {
    expect(agingBucket(0)).toBe('0-30');
    expect(agingBucket(30)).toBe('0-30');
    expect(agingBucket(31)).toBe('31-60');
    expect(agingBucket(75)).toBe('61-90');
    expect(agingBucket(120)).toBe('90+');
  });
});
