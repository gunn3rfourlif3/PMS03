import { cascadeSend, parseChannels } from '@providers/notification/cascade';
import { Channel, ChannelProvider, DeliveryResult } from '@providers/notification/notification-provider.interface';

function provider(channel: Channel, result: DeliveryResult, spy?: (to: string) => void): ChannelProvider {
  return {
    channel,
    async send(req) { spy?.(req.to); return result; },
  };
}

const ok = (ref: string): DeliveryResult => ({ ok: true, providerRef: ref });
const fail = (e: string): DeliveryResult => ({ ok: false, error: e });

const build = (_c: Channel, to: string) => ({ to, subject: 's', body: 'b' });

describe('parseChannels', () => {
  it('parses an ordered list and lowercases', () => {
    expect(parseChannels('whatsapp, Email')).toEqual(['whatsapp', 'email']);
  });
  it('falls back when empty', () => {
    expect(parseChannels('')).toEqual(['whatsapp', 'email']);
    expect(parseChannels(undefined, ['email'])).toEqual(['email']);
  });
});

describe('cascadeSend', () => {
  const contacts = { phone: '+27821234567', email: 'a@b.com' };

  it('stops at the first successful channel', async () => {
    const providers = new Map<Channel, ChannelProvider>([
      ['whatsapp', provider('whatsapp', ok('wa1'))],
      ['email', provider('email', ok('em1'))],
    ]);
    const r = await cascadeSend(providers, ['whatsapp', 'email'], contacts, build);
    expect(r).toEqual({ channel: 'whatsapp', providerRef: 'wa1' });
  });

  it('falls through to email when whatsapp fails', async () => {
    const providers = new Map<Channel, ChannelProvider>([
      ['whatsapp', provider('whatsapp', fail('wa down'))],
      ['email', provider('email', ok('em1'))],
    ]);
    const r = await cascadeSend(providers, ['whatsapp', 'email'], contacts, build);
    expect(r).toEqual({ channel: 'email', providerRef: 'em1' });
  });

  it('skips a channel whose provider is absent', async () => {
    const providers = new Map<Channel, ChannelProvider>([
      ['email', provider('email', ok('em1'))],
    ]);
    const r = await cascadeSend(providers, ['whatsapp', 'email'], contacts, build);
    expect(r?.channel).toBe('email');
  });

  it('skips a channel whose contact is missing (no phone → whatsapp skipped)', async () => {
    let waTried = false;
    const providers = new Map<Channel, ChannelProvider>([
      ['whatsapp', provider('whatsapp', ok('wa1'), () => { waTried = true; })],
      ['email', provider('email', ok('em1'))],
    ]);
    const r = await cascadeSend(providers, ['whatsapp', 'email'], { email: 'a@b.com' }, build);
    expect(waTried).toBe(false);
    expect(r?.channel).toBe('email');
  });

  it('returns null when nothing can be delivered', async () => {
    const providers = new Map<Channel, ChannelProvider>([
      ['whatsapp', provider('whatsapp', fail('x'))],
    ]);
    const r = await cascadeSend(providers, ['whatsapp', 'email'], { phone: '+27821234567' }, build);
    expect(r).toBeNull();
  });
});
