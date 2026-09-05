/**
 * Regression: a relay accepting a message is not delivery.
 *
 * A placeholder LEADS_NOTIFY_EMAIL on a domain with no MX produced nine
 * consecutive "lead notify sent" log lines and no email, because the provider
 * reported success on SMTP hand-off and nothing checked the recipient domain.
 * Two guards, one per failure mode: a synchronous RCPT-TO rejection must be
 * reported as a failure, and an undeliverable recipient must be caught at boot.
 */
import { Logger } from '@nestjs/common';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));

const resolveMx = jest.fn();
jest.mock('node:dns/promises', () => ({ resolveMx: (d: string) => resolveMx(d) }));

// Imported after the mocks: the provider builds its transport at field init.
import { SmtpEmailProvider } from '@providers/notification/http.providers';
import { LeadsService } from '@modules/leads/leads.service';

describe('SmtpEmailProvider reports acceptance, not delivery', () => {
  beforeEach(() => sendMail.mockReset());

  it('fails when the relay rejects the recipient', async () => {
    sendMail.mockResolvedValue({
      messageId: '<id@locare.co.za>',
      accepted: [],
      rejected: ['you@dantalan.co.za'],
      response: '550 5.1.1 no such user',
    });
    const res = await new SmtpEmailProvider().send({
      to: 'you@dantalan.co.za', subject: 's', body: 'b',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('550');
    expect(res.rejected).toEqual(['you@dantalan.co.za']);
  });

  it('succeeds only when the recipient is in accepted', async () => {
    sendMail.mockResolvedValue({
      messageId: '<id@locare.co.za>',
      accepted: ['Arthur@locare.co.za'], // case must not matter
      rejected: [],
    });
    const res = await new SmtpEmailProvider().send({
      to: 'arthur@locare.co.za', subject: 's', body: 'b',
    });
    expect(res.ok).toBe(true);
    expect(res.providerRef).toBe('<id@locare.co.za>');
  });
});

describe('LeadsService checks the notify address at boot', () => {
  const service = () => new LeadsService({ query: jest.fn() } as any, undefined);
  let errors: string[];

  beforeEach(() => {
    errors = [];
    resolveMx.mockReset();
    jest.spyOn(Logger.prototype, 'error').mockImplementation((m: any) => { errors.push(String(m)); });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('reports a recipient domain with no mail service', async () => {
    process.env.LEADS_NOTIFY_EMAIL = 'you@dantalan.co.za';
    resolveMx.mockImplementation(async (d: string) =>
      d === 'locare.co.za' ? [{ exchange: 'mail.locare.co.za', priority: 10 }] : [],
    );
    await service().onModuleInit();
    expect(errors.some((e) => e.includes('dantalan.co.za') && e.includes('no reachable MX'))).toBe(true);
  });

  it('stays quiet when the domain resolves', async () => {
    process.env.LEADS_NOTIFY_EMAIL = 'arthur@locare.co.za';
    resolveMx.mockResolvedValue([{ exchange: 'mail.locare.co.za', priority: 10 }]);
    await service().onModuleInit();
    expect(errors).toEqual([]);
  });

  it('does not throw when DNS itself fails', async () => {
    process.env.LEADS_NOTIFY_EMAIL = 'arthur@locare.co.za';
    resolveMx.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }));
    await expect(service().onModuleInit()).resolves.toBeUndefined();
  });
});

describe('LeadsService acknowledges the submitter', () => {
  const send = jest.fn();
  const channels = new Map([['email', { channel: 'email', send, constructor: { name: 'SmtpEmailProvider' } } as any]]);
  const service = () => new LeadsService({ query: jest.fn() } as any, channels as any);

  beforeEach(() => {
    send.mockReset().mockResolvedValue({ ok: true, providerRef: '<ack@locare.co.za>' });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    process.env.LEADS_NOTIFY_EMAIL = 'hello@locare.co.za';
    process.env.LEADS_ACK_FROM = 'daniel@locare.co.za';
    process.env.LEADS_ACK_FROM_NAME = 'Daniel';
    delete process.env.LEADS_ACK;
  });
  afterEach(() => jest.restoreAllMocks());

  const ack = () => send.mock.calls.map((c) => c[0]).find((m) => m.to === 'sam@agency.co.za');

  it('sends from the configured person, to the submitter', async () => {
    await service().create({ type: 'demo', name: 'Sam Nkosi', email: 'sam@agency.co.za' });
    expect(ack()).toMatchObject({
      to: 'sam@agency.co.za',
      from: { email: 'daniel@locare.co.za', name: 'Daniel' },
    });
    expect(ack().body).toContain('Hi Sam,');
    expect(ack().body).toContain('https://locare.co.za/demo');
  });

  it('does not double-email partner registrations', async () => {
    await service().create({ type: 'agent', name: 'Sam Nkosi', email: 'sam@agency.co.za' });
    expect(ack()).toBeUndefined();
  });

  it('honours LEADS_ACK=off', async () => {
    process.env.LEADS_ACK = 'off';
    await service().create({ type: 'demo', name: 'Sam Nkosi', email: 'sam@agency.co.za' });
    expect(ack()).toBeUndefined();
  });

  it('still captures the lead when the ack fails', async () => {
    const query = jest.fn();
    send.mockRejectedValue(new Error('relay down'));
    const svc = new LeadsService({ query } as any, channels as any);
    await expect(svc.create({ type: 'demo', name: 'Sam', email: 'sam@agency.co.za' })).resolves.toEqual({ received: true });
    expect(query).toHaveBeenCalled();
  });
});
