import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { fromEvent, Observable } from 'rxjs';

export interface MessageEvent {
  vendorId: string;
  tenantUserId: string;
  conversationId: string;
  at: string;
}

/**
 * Tiny in-process pub/sub for message activity. Powers the SSE stream so the
 * web console updates live without polling. (For multi-instance deploys this
 * would move behind Redis pub/sub — the interface stays the same.)
 */
@Injectable()
export class CommsEvents {
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  publish(evt: MessageEvent): void {
    this.emitter.emit('message', evt);
  }

  stream(): Observable<MessageEvent> {
    return fromEvent(this.emitter, 'message') as Observable<MessageEvent>;
  }
}
