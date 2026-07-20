import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommsEvents } from '../src/modules/comms/comms.events';

describe('CommsEvents (in-process pub/sub for SSE)', () => {
  it('delivers a published message to subscribers', async () => {
    const bus = new CommsEvents();
    const next = firstValueFrom(bus.stream().pipe(take(1)));
    const evt = { vendorId: 'v1', tenantUserId: 'u1', conversationId: 'c1', at: new Date().toISOString() };
    setTimeout(() => bus.publish(evt), 0);
    await expect(next).resolves.toEqual(evt);
  });
});
