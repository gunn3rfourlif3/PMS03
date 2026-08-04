import { Channel, ChannelProvider, DeliveryRequest } from './notification-provider.interface';

export interface CascadeContacts {
  phone?: string | null; // used by whatsapp + sms
  email?: string | null; // used by email
}

/** Build the channel-specific delivery request for a given leg of the cascade. */
export type ChannelReqBuilder = (channel: Channel, to: string) => DeliveryRequest;

/**
 * Deliver over an ordered list of channels, stopping at the first success.
 * A channel is skipped when its provider isn't configured or the matching
 * contact is missing (email leg needs an email; whatsapp/sms need a phone).
 * Returns the channel that succeeded, or null if nothing could be delivered.
 */
export async function cascadeSend(
  providers: Map<Channel, ChannelProvider>,
  order: Channel[],
  contacts: CascadeContacts,
  build: ChannelReqBuilder,
): Promise<{ channel: Channel; providerRef?: string } | null> {
  for (const channel of order) {
    const provider = providers.get(channel);
    if (!provider) continue;
    const to = channel === 'email' ? contacts.email : contacts.phone;
    if (!to) continue;
    const res = await provider.send(build(channel, to));
    if (res.ok) return { channel, providerRef: res.providerRef };
  }
  return null;
}

/** Parse an ordered channel list from env (e.g. "whatsapp,email"). */
export function parseChannels(env?: string, fallback: Channel[] = ['whatsapp', 'email']): Channel[] {
  const list = (env ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as Channel[];
  return list.length ? list : fallback;
}
