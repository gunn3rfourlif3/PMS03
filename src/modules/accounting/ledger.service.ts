import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerEntry } from './ledger-entry.entity';
import {
  JournalLineInput,
  assertBalanced,
  reverseLines,
} from './double-entry';

export interface PostTransactionInput {
  lines: JournalLineInput[];
  postedAt?: Date;
  /** Optional caller-supplied id (idempotency); generated if absent. */
  transactionId?: string;
}

/**
 * The posting engine. Every financial event flows through here so the ledger
 * is always balanced and append-only.
 *
 *  - post(): validates debits === credits, then writes all lines inside the
 *    request's tenant transaction (RLS-scoped). All-or-nothing.
 *  - reverse(): the ONLY way to "undo" — posts the mirror image of a prior
 *    transaction. Ledger rows are never updated or deleted.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly tenant: TenantContextService) {}

  async post(input: PostTransactionInput): Promise<string> {
    assertBalanced(input.lines);
    const transactionId = input.transactionId ?? randomUUID();
    const postedAt = input.postedAt ?? new Date();
    const vendorId = this.tenant.vendorId ?? undefined;

    const repo = this.tenant.getRepository(LedgerEntry);
    const rows = input.lines.map((l) =>
      repo.create({
        vendorId,
        transactionId,
        accountId: l.accountId,
        debit: l.debit ?? 0,
        credit: l.credit ?? 0,
        entityRef: l.entityRef,
        postedAt,
      }),
    );
    // Runs inside the RlsInterceptor transaction => atomic with its request.
    await repo.save(rows);
    this.logger.debug(`Posted txn ${transactionId} (${rows.length} lines)`);
    return transactionId;
  }

  /** Post reversing entries for a previously-posted transaction. */
  async reverse(transactionId: string, postedAt?: Date): Promise<string> {
    const repo = this.tenant.getRepository(LedgerEntry);
    const original = await repo.find({ where: { transactionId } });
    if (original.length === 0) {
      throw new Error(`No transaction ${transactionId} to reverse`);
    }
    const reversal = reverseLines(
      original.map((r) => ({
        accountId: r.accountId,
        debit: Number(r.debit),
        credit: Number(r.credit),
        entityRef: r.entityRef,
      })),
    );
    return this.post({ lines: reversal, postedAt });
  }
}
