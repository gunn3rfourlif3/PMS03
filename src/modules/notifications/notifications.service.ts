import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_NOTIFICATIONS,
  JOB_SEND_NOTIFICATION,
} from '@common/queue/queue.constants';
import { TemplateKey } from './templates';
import { Channel } from '@providers/notification/notification-provider.interface';

export interface NotifyInput {
  vendorId: string;
  userId?: string;
  destination?: string;
  template: TemplateKey;
  payload: Record<string, unknown>;
  channels?: Channel[];
}

/**
 * Fire-and-forget notification entrypoint. Domain code calls enqueue() and
 * returns immediately; rendering, preference checks, and multi-channel delivery
 * happen asynchronously in the processor.
 */
@Injectable()
export class NotificationsService {
  constructor(@InjectQueue(QUEUE_NOTIFICATIONS) private readonly queue: Queue) {}

  ping(): string {
    return 'Notifications module ready';
  }

  async enqueue(input: NotifyInput): Promise<void> {
    await this.queue.add(JOB_SEND_NOTIFICATION, input);
  }
}
