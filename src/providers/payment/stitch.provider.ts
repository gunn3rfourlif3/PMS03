import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';
import { payerReference, beneficiaryReference, moneyInput } from './stitch-refs';
import { toStitchBankId, toStitchAccountType, disbursementType } from './stitch-banks';
import { RefundCapable, RefundRequest, RefundResult } from './refund-provider.interface';

/**
 * Stitch disbursement states → our three-state PayoutResult.
 * `Completed` is not strictly final — a bank can still reverse it — which is
 * why the disbursement webhook matters as much as this return value.
 */
export function disbursementStatus(typename?: string): PayoutResult['status'] {
  switch (typename) {
    case 'DisbursementCompleted': return 'paid';
    case 'DisbursementError':
    case 'DisbursementCancelled':
    case 'DisbursementReversed': return 'failed';
    // Pending, Submitted and Paused are all "in flight". Paused usually means an
    // under-funded float, which resolves on top-up rather than by retrying.
    default: return 'scheduled';
  }
}

const TOKEN_URL = 'https://secure.stitch.money/connect/token';
const GRAPHQL_URL = 'https://api.stitch.money/graphql';

const CREATE_PAYMENT_REQUEST = `
mutation CreatePaymentRequest(
  $amount: MoneyInput!, $payerReference: String!, $beneficiaryReference: String!,
  $externalReference: String, $expireAt: Date, $payerInformation: PayerInformationInput,
  $merchantId: String, $externalMerchantId: String
) {
  clientPaymentInitiationRequestCreate(input: {
    amount: $amount,
    payerReference: $payerReference,
    beneficiaryReference: $beneficiaryReference,
    externalReference: $externalReference,
    expireAt: $expireAt,
    payerInformation: $payerInformation,
    merchantId: $merchantId,
    externalMerchantId: $externalMerchantId
  }) {
    paymentInitiationRequest { id url }
  }
}`;

const CREATE_REFUND = `
mutation CreateRefund(
  $amount: MoneyInput!, $reason: RefundReason!, $nonce: String!,
  $clearingType: ClearingType!, $beneficiaryReference: String!,
  $paymentRequestId: ID!, $externalReference: String
) {
  clientRefundInitiate(input: {
    amount: $amount, reason: $reason, nonce: $nonce, clearingType: $clearingType,
    beneficiaryReference: $beneficiaryReference, paymentRequestId: $paymentRequestId,
    externalReference: $externalReference
  }) {
    refund { id }
  }
}`;

const CREATE_DISBURSEMENT = `
mutation CreateDisbursement(
  $amount: MoneyInput!, $type: DisbursementType!, $nonce: String!,
  $externalReference: String, $beneficiaryReference: String!, $name: String!,
  $accountNumber: String!, $accountType: AccountType!,
  $bankId: DisbursementBankBeneficiaryBankId!,
  $payeeInformation: DisbursementCreateRecipientAccountHolderDetailsInput!
) {
  clientDisbursementCreate(input: {
    amount: $amount,
    nonce: $nonce,
    externalReference: $externalReference,
    bankBeneficiary: { name: $name, bankId: $bankId, accountNumber: $accountNumber, accountType: $accountType },
    disbursementType: $type,
    beneficiaryReference: $beneficiaryReference,
    recipientAccountHolder: $payeeInformation
  }) {
    disbursement { id status { __typename } }
  }
}`;

/**
 * Stitch — pay-by-bank (instant EFT, Capitec Pay, Absa Pay, PayShap RTP).
 *
 * A single payment request surfaces every method enabled on the client, so
 * there is no per-method code here.
 *
 * TRUST-MONEY RULE (PPA): do not auto-split the platform fee out of client
 * money. Rent settles to the agency's beneficiary account; Locare's fee is
 * collected separately.
 *
 * ⚠ The redirect back from Stitch carries a `status` query parameter. It is NOT
 * trustworthy — anyone can edit a query string — and Stitch's own documentation
 * says so. Reconciliation must happen off the signed webhook. This provider
 * deliberately returns only `pending` from `collect()`; nothing here can mark
 * an invoice paid.
 */
@Injectable()
export class StitchPaymentProvider implements PaymentProvider, RefundCapable {
  readonly name = 'stitch';
  private readonly logger = new Logger('Stitch');

  /**
   * Tokens last an hour and Stitch asks that they be cached rather than minted
   * per call — but a token carries the scopes it was requested with, so the
   * cache is keyed BY SCOPE. A single shared slot would hand a
   * `client_paymentrequest` token to a refund and get it rejected.
   */
  private tokens = new Map<string, { value: string; expiresAt: number }>();

  private get clientId() { return process.env.STITCH_CLIENT_ID; }
  private get clientSecret() { return process.env.STITCH_CLIENT_SECRET; }
  private get live() { return process.env.STITCH_LIVE === 'true'; }

  private async accessToken(scope = 'client_paymentrequest'): Promise<string> {
    // 60s of headroom so a token cannot expire mid-flight.
    const cached = this.tokens.get(scope);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId!,
      scope,
      audience: TOKEN_URL,
      client_secret: this.clientSecret!,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Stitch token request failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.tokens.set(scope, {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });
    return json.access_token;
  }

  async collect(req: CollectRequest): Promise<CollectResult> {
    const providerRef = `stitch_${req.invoiceId}`;
    // Stubbed unless explicitly enabled and configured — same shape as the other
    // rails, so an unconfigured environment degrades instead of throwing.
    if (!this.live || !this.clientId || !this.clientSecret) {
      return { providerRef, status: 'pending' };
    }

    try {
      const token = await this.accessToken();
      const expiryHours = Number(process.env.STITCH_EXPIRY_HOURS) || 24;

      const variables = {
        amount: moneyInput(req.amount, req.currency),
        payerReference: payerReference(req.invoiceId, process.env.STITCH_PAYER_REF_PREFIX),
        beneficiaryReference: beneficiaryReference(req.invoiceId),
        externalReference: req.invoiceId, // full id — this is what we match on
        expireAt: new Date(Date.now() + expiryHours * 3_600_000).toISOString(),
        payerInformation: {
          // Stable per-tenant id improves Stitch's fraud checks. We do not have a
          // tenant id on CollectRequest, so the invoice's payer email is used
          // where present, falling back to the vendor.
          payerId: req.payerEmail ?? req.vendorId,
          ...(req.payerEmail ? { email: req.payerEmail } : {}),
        },
        // Per-agency merchant routing (see docs/LOCARE_DEBIT_ORDER_DESIGN.md §7):
        // settlement goes to the merchant registered for this agency, not to a
        // Locare-level beneficiary. Absent, Stitch settles to the client default.
        ...(process.env.STITCH_EXTERNAL_MERCHANT_ID_FROM_VENDOR === 'true'
          ? { externalMerchantId: req.vendorId }
          : {}),
      };

      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: CREATE_PAYMENT_REQUEST, variables }),
      });

      const json = (await res.json()) as any;
      // GraphQL answers 200 with an `errors` array, so status alone proves nothing.
      if (json?.errors?.length) {
        throw new Error(json.errors.map((e: any) => e.message).join('; '));
      }
      const pr = json?.data?.clientPaymentInitiationRequestCreate?.paymentInitiationRequest;
      if (!pr?.id || !pr?.url) throw new Error('Stitch returned no payment request');

      const redirect = process.env.STITCH_REDIRECT_URI;
      const url = redirect ? `${pr.url}?redirect_uri=${encodeURIComponent(redirect)}` : pr.url;

      // providerRef is Stitch's id: it is what the webhook will quote.
      return { providerRef: pr.id, status: 'pending', redirectUrl: url };
    } catch (e: any) {
      this.logger.error(`collect failed for invoice ${req.invoiceId}: ${e.message}`);
      return { providerRef, status: 'failed' };
    }
  }

  /**
   * Reverse a pay-by-bank payment to the account it came from. Partial refunds
   * are allowed, up to the original amount less anything already refunded.
   *
   * ⚠ TRUST MONEY. Refunded funds are debited from the Stitch intermediary
   * float, not from the agency's trust account, so the ledger and the bank
   * disagree until settlement catches up. Corrections are new postings, never
   * edits — this method moves money at the gateway and returns; it deliberately
   * does not touch the ledger. Posting the reversal is the caller's decision.
   */
  async refund(req: RefundRequest): Promise<RefundResult> {
    if (!req.idempotencyKey) {
      throw new BadRequestException('A refund idempotencyKey is required (refunding twice cannot be undone).');
    }
    if (!this.live || !this.clientId || !this.clientSecret) {
      throw new NotImplementedException('Stitch is not configured for live refunds.');
    }

    const token = await this.accessToken('client_refund');
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: CREATE_REFUND,
        variables: {
          amount: moneyInput(req.amount, req.currency),
          reason: req.reason,
          nonce: req.idempotencyKey,
          clearingType: process.env.STITCH_INSTANT_REFUNDS === 'true' ? 'INSTANT' : 'DEFAULT',
          beneficiaryReference: (req.statementReference ?? beneficiaryReference(req.idempotencyKey)).slice(0, 20),
          paymentRequestId: req.paymentRef,
          externalReference: req.idempotencyKey,
        },
      }),
    });

    const json = (await res.json()) as any;
    if (json?.errors?.length) {
      const err = json.errors[0];
      const code = err?.extensions?.code;
      // A duplicate nonce means this refund already exists — the retry did its
      // job. Anything else is a real refusal and must reach an operator.
      if (code === 'NONCE_DUPLICATE') {
        this.logger.warn(`Refund ${req.idempotencyKey} already issued — treating as pending`);
        return { providerRef: `stitch_refund_${req.idempotencyKey}`, status: 'pending' };
      }
      const message = `${code ?? 'ERROR'}: ${err?.message ?? 'refund failed'}`;
      this.logger.error(`Refund failed for ${req.paymentRef} — ${message}`);
      return { providerRef: `stitch_refund_${req.idempotencyKey}`, status: 'failed', error: message };
    }

    const id = json?.data?.clientRefundInitiate?.refund?.id;
    if (!id) return { providerRef: `stitch_refund_${req.idempotencyKey}`, status: 'failed', error: 'No refund id returned' };
    // Never 'paid' here: a refund is only complete when the webhook says so.
    return { providerRef: id, status: 'pending' };
  }

  /**
   * Owner payout via Stitch Disbursements. ZA-only, and requires a funded float
   * account — an under-funded float parks the disbursement as
   * `DisbursementPaused` for seven days before erroring.
   *
   * `nonce` is the whole safety story. Stitch rejects a repeat of the same
   * nonce, so a timed-out request is retried with the SAME key rather than
   * paying an owner twice. It therefore comes from the caller's statement id,
   * never from a random value generated here.
   */
  async payout(req: PayoutRequest): Promise<PayoutResult> {
    const nonce = req.idempotencyKey;
    if (!nonce) {
      // Refusing beats generating one: a random nonce silently converts every
      // retry into a duplicate payout.
      throw new BadRequestException(
        'A payout idempotencyKey is required for Stitch disbursements (use the owner statement id).',
      );
    }
    const providerRef = `stitch_payout_${nonce}`;
    if (!this.live || !this.clientId || !this.clientSecret) {
      throw new NotImplementedException(
        'Stitch is not configured for live disbursements — set STITCH_LIVE and credentials, or point PAYOUT_PROVIDER elsewhere.',
      );
    }

    const acct = req.bankAccount ?? {};
    const bankId = toStitchBankId(acct.bankName, acct.branchCode);
    if (!bankId || !acct.accountNumber) {
      throw new BadRequestException(
        `Cannot map "${acct.bankName ?? 'unknown bank'}" to a Stitch bank — check the owner's banking details.`,
      );
    }

    const token = await this.accessToken('client_disbursement');
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: CREATE_DISBURSEMENT,
        variables: {
          amount: moneyInput(req.amount, req.currency),
          nonce,
          externalReference: nonce,
          beneficiaryReference: beneficiaryReference(nonce),
          name: (acct.accountHolder ?? 'Owner').slice(0, 20),
          accountNumber: acct.accountNumber,
          accountType: toStitchAccountType(acct.accountType),
          bankId,
          type: disbursementType(bankId, process.env.STITCH_INSTANT_PAYOUTS === 'true'),
          payeeInformation: { payeeId: req.ownerId, name: acct.accountHolder ?? 'Owner' },
        },
      }),
    });

    const json = (await res.json()) as any;
    if (json?.errors?.length) {
      const message = json.errors.map((e: any) => e.message).join('; ');
      // A duplicate nonce means this payout already exists — the retry worked as
      // designed, so report it as scheduled rather than failing the statement.
      if (/nonce/i.test(message) && /duplicate|exists|unique/i.test(message)) {
        this.logger.warn(`Disbursement ${nonce} already exists — treating as scheduled`);
        return { providerRef, status: 'scheduled' };
      }
      this.logger.error(`Disbursement failed for ${nonce}: ${message}`);
      return { providerRef, status: 'failed' };
    }

    const d = json?.data?.clientDisbursementCreate?.disbursement;
    if (!d?.id) {
      this.logger.error(`Disbursement returned no id for ${nonce}`);
      return { providerRef, status: 'failed' };
    }
    return { providerRef: d.id, status: disbursementStatus(d.status?.__typename) };
  }
}
