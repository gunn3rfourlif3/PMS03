/**
 * The TLS allowlist decides which hostnames this deployment will ask Let's
 * Encrypt to certify. A false positive means anyone who points a domain at the
 * VPS gets a certificate issued in Locare's name, so these are security
 * assertions, not formatting checks.
 *
 * See docs/LOCARE_ONDEMAND_TLS_DESIGN.md §8.
 */
import { normaliseHost, parseHost } from '@modules/hosts/host-name';
import { HostsService } from '@modules/hosts/hosts.service';

const PD = 'locare.co.za';

// @types/node declares NODE_ENV readonly; the index signature is the way in.
const setEnv = (k: string, v: string) => { (process.env as Record<string, string>)[k] = v; };

describe('normaliseHost', () => {
  it.each([
    ['lowercases', 'App.Agency.CO.ZA', 'app.agency.co.za'],
    ['strips a port', 'app.agency.co.za:8443', 'app.agency.co.za'],
    ['strips the root dot', 'app.agency.co.za.', 'app.agency.co.za'],
    ['trims', '  agency.co.za ', 'agency.co.za'],
  ])('%s', (_l, input, expected) => expect(normaliseHost(input)).toBe(expected));

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['localhost', 'localhost'],
    ['an IPv4 address', '169.58.46.223'],
    ['a single label', 'agency'],
    ['an underscore', 'app_1.agency.co.za'],
    ['a smuggled path', 'agency.co.za/../x'],
    ['a smuggled scheme', 'https://agency.co.za'],
    ['a trailing hyphen label', 'app-.agency.co.za'],
    ['an over-long name', `${'a'.repeat(250)}.co.za`],
  ])('rejects %s', (_l, input) => expect(normaliseHost(input as string)).toBeNull());
});

describe('parseHost', () => {
  it.each([
    ['app', 'app.agency.co.za', 'agency.co.za'],
    ['api', 'api.agency.co.za', 'agency.co.za'],
    ['tenant', 'tenant.agency.co.za', 'agency.co.za'],
    ['landlord', 'landlord.agency.co.za', 'agency.co.za'],
    ['rentals', 'rentals.agency.co.za', 'agency.co.za'],
    ['www', 'www.agency.co.za', 'agency.co.za'],
  ])('strips the %s label', (_l, host, base) => expect(parseHost(host, PD).base).toBe(base));

  it('leaves an apex alone', () => {
    expect(parseHost('agency.co.za', PD).base).toBe('agency.co.za');
  });

  // Two labels only: stripping here would leave a bare TLD and match anything.
  it('does not mistake a label in front of a TLD for an app label', () => {
    expect(parseHost('app.co.za', PD).base).toBe('app.co.za');
  });

  it('keeps a non-app subdomain', () => {
    expect(parseHost('portal.agency.co.za', PD).base).toBe('portal.agency.co.za');
  });

  it('extracts a platform slug', () => {
    expect(parseHost('app.acme.locare.co.za', PD)).toMatchObject({ base: 'acme.locare.co.za', slug: 'acme' });
  });

  it('does not treat a deeper name as a slug', () => {
    expect(parseHost('a.b.locare.co.za', PD).slug).toBe('');
  });

  it('reports no slug for an unrelated domain', () => {
    expect(parseHost('app.agency.co.za', PD).slug).toBe('');
  });
});

describe('HostsService.isAllowed', () => {
  const svc = (ok: boolean | Error) => {
    const query = jest.fn(async () => {
      if (ok instanceof Error) throw ok;
      return [{ ok }];
    });
    return { service: new HostsService({ query } as any), query };
  };

  beforeEach(() => {
    process.env.PLATFORM_DOMAIN = PD;
    delete process.env.TLS_EXTRA_HOSTS;
  });

  it('allows a domain an active vendor claims', async () => {
    const { service, query } = svc(true);
    await expect(service.isAllowed('app.agency.co.za')).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('tls_host_allowed'), ['agency.co.za', '']);
  });

  it('refuses a domain no vendor claims', async () => {
    const { service } = svc(false);
    await expect(service.isAllowed('app.someoneelse.co.za')).resolves.toBe(false);
  });

  it('serves the platform without touching the database', async () => {
    const { service, query } = svc(false);
    await expect(service.isAllowed('app.locare.co.za')).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('honours TLS_EXTRA_HOSTS', async () => {
    process.env.TLS_EXTRA_HOSTS = 'app.dantalan.co.za';
    const { service } = svc(false);
    await expect(service.isAllowed('app.dantalan.co.za')).resolves.toBe(true);
  });

  it.each([['garbage', 'not a host'], ['an IP', '169.58.46.223'], ['empty', '']])(
    'refuses %s without querying', async (_l, host) => {
      const { service, query } = svc(true);
      await expect(service.isAllowed(host)).resolves.toBe(false);
      expect(query).not.toHaveBeenCalled();
    },
  );

  // Refusing a certificate is recoverable. Issuing one we cannot vouch for is not.
  it('denies when the database is unreachable', async () => {
    const { service } = svc(new Error('connection refused'));
    await expect(service.isAllowed('app.agency.co.za')).resolves.toBe(false);
  });

  it('caches a decision instead of querying per handshake', async () => {
    const { service, query } = svc(true);
    await service.isAllowed('app.agency.co.za');
    await service.isAllowed('app.agency.co.za');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('HostsService.isAllowedOrigin', () => {
  const svc = (claims: boolean) => {
    const query = jest.fn(async () => [{ ok: claims }]);
    return { service: new HostsService({ query } as any), query };
  };

  beforeEach(() => {
    process.env.PLATFORM_DOMAIN = PD;
    setEnv('NODE_ENV', 'production');
    process.env.CORS_ORIGINS = 'https://app.dantalan.co.za,https://dantalan.co.za';
    delete process.env.TLS_EXTRA_HOSTS;
  });
  afterEach(() => setEnv('NODE_ENV', 'test'));

  it('allows a configured origin without a database lookup', async () => {
    const { service, query } = svc(false);
    await expect(service.isAllowedOrigin('https://app.dantalan.co.za')).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('tolerates a trailing slash and odd casing on the configured list', async () => {
    const { service } = svc(false);
    await expect(service.isAllowedOrigin('https://APP.dantalan.co.za/')).resolves.toBe(true);
  });

  // The whole point: a domain set in the back-office works with no redeploy.
  it('allows an origin whose host an active vendor claims', async () => {
    const { service, query } = svc(true);
    await expect(service.isAllowedOrigin('https://app.newagency.co.za')).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('tls_host_allowed'), ['newagency.co.za', '']);
  });

  it('refuses an origin nobody claims', async () => {
    const { service } = svc(false);
    await expect(service.isAllowedOrigin('https://evil.example.com')).resolves.toBe(false);
  });

  it('refuses http in production, even for a claimed host', async () => {
    const { service } = svc(true);
    await expect(service.isAllowedOrigin('http://app.newagency.co.za')).resolves.toBe(false);
  });

  it('refuses localhost in production', async () => {
    const { service } = svc(true);
    await expect(service.isAllowedOrigin('http://localhost:3001')).resolves.toBe(false);
  });

  it('allows localhost outside production', async () => {
    setEnv('NODE_ENV', 'development');
    const { service } = svc(false);
    await expect(service.isAllowedOrigin('http://localhost:3001')).resolves.toBe(true);
  });

  // No Origin header at all: a webhook or curl, not a browser. Nothing to police.
  it.each([['undefined', undefined], ['empty', '']])('allows a request with %s origin', async (_l, o) => {
    const { service } = svc(false);
    await expect(service.isAllowedOrigin(o as string)).resolves.toBe(true);
  });

  it.each([['garbage', 'not-a-url'], ['a bare host', 'app.newagency.co.za'], ['a file url', 'file:///etc/passwd']])(
    'refuses %s', async (_l, o) => {
      const { service } = svc(true);
      await expect(service.isAllowedOrigin(o)).resolves.toBe(false);
    },
  );
});
