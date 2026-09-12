import { normaliseCustomDomain } from '../src/modules/hosts/custom-domain';
import { hostsFor } from '../src/modules/hosts/admin-domains.controller';
import { parseHost } from '../src/modules/hosts/host-name';

const PD = 'locare.co.za';
const ok = (r: any) => { if (!r.ok) throw new Error(r.error); return r.domain as string; };
const err = (r: any) => { if (r.ok) throw new Error(`expected failure, got ${r.domain}`); return r.error as string; };

describe('custom domain', () => {
  it('stores the bare domain, whatever the operator pasted', () => {
    // The stored value is matched against a handshake host AFTER the app label
    // is stripped, so storing app.kimaz.co.za would silently never match.
    expect(ok(normaliseCustomDomain('kimaz.co.za', PD))).toBe('kimaz.co.za');
    expect(ok(normaliseCustomDomain('app.kimaz.co.za', PD))).toBe('kimaz.co.za');
    expect(ok(normaliseCustomDomain('https://app.kimaz.co.za/login', PD))).toBe('kimaz.co.za');
    expect(ok(normaliseCustomDomain('  APP.Kimaz.CO.ZA  ', PD))).toBe('kimaz.co.za');
    expect(ok(normaliseCustomDomain('www.kimaz.co.za', PD))).toBe('kimaz.co.za');
    expect(ok(normaliseCustomDomain('app.kimaz.co.za:443', PD))).toBe('kimaz.co.za');
  });

  it('reports when it changed what was typed', () => {
    const a: any = normaliseCustomDomain('https://app.kimaz.co.za/', PD);
    expect(a.changed).toBe(true);
    const b: any = normaliseCustomDomain('kimaz.co.za', PD);
    expect(b.changed).toBe(false);
  });

  it('refuses a Locare domain', () => {
    // An agency claiming a locare.co.za subdomain would be issued a certificate
    // for a host the platform serves itself.
    expect(err(normaliseCustomDomain('locare.co.za', PD))).toMatch(/belongs to Locare/);
    expect(err(normaliseCustomDomain('app.acme.locare.co.za', PD))).toMatch(/belongs to Locare/);
  });

  it('refuses what is not a domain at all', () => {
    expect(err(normaliseCustomDomain('', PD))).toMatch(/Enter a domain/);
    expect(err(normaliseCustomDomain('   ', PD))).toMatch(/Enter a domain/);
    expect(err(normaliseCustomDomain('not a domain', PD))).toMatch(/not a valid domain/);
    expect(err(normaliseCustomDomain('localhost', PD))).toMatch(/not a valid domain/);
    expect(err(normaliseCustomDomain('169.58.46.223', PD))).toMatch(/not a valid domain/);
  });

  it('refuses a public suffix nobody can register', () => {
    expect(err(normaliseCustomDomain('co.za', PD))).toMatch(/public suffix/);
    expect(err(normaliseCustomDomain('org.uk', PD))).toMatch(/public suffix/);
  });

  it('does not mistake a short domain for a label plus a suffix', () => {
    // app.co.za is a domain someone can register, not the label "app" in front
    // of the public suffix co.za.
    expect(ok(normaliseCustomDomain('app.co.za', PD))).toBe('app.co.za');
  });

  it('keeps a domain that is not under a known public suffix', () => {
    expect(ok(normaliseCustomDomain('app.example.com', PD))).toBe('example.com');
    expect(ok(normaliseCustomDomain('lettings.co.bw', PD))).toBe('lettings.co.bw');
  });
});

describe('the DNS records handed to the operator', () => {
  const hosts = hostsFor('kimaz.co.za');

  it('lists the apex and every app label, www included', () => {
    expect(hosts).toEqual([
      'kimaz.co.za',
      'www.kimaz.co.za',
      'app.kimaz.co.za',
      'api.kimaz.co.za',
      'tenant.kimaz.co.za',
      'landlord.kimaz.co.za',
      'rentals.kimaz.co.za',
    ]);
  });

  /**
   * The failure this guards against is silent and slow: a host the panel does
   * not list is a record nobody creates, which shows up days later as one
   * surface that will not load. www was missing exactly this way.
   */
  it('lists nothing the TLS allowlist would then refuse', () => {
    for (const h of hosts) {
      expect(parseHost(h, PD).base).toBe('kimaz.co.za');
    }
  });

  it('has no hosts at all without a domain', () => {
    expect(hostsFor(null)).toEqual([]);
    expect(hostsFor('')).toEqual([]);
    expect(hostsFor(undefined)).toEqual([]);
  });
});
