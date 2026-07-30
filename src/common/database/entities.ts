/**
 * Central registry of persisted entities. Keeping this in one place lets the
 * TypeORM DataSource (migrations/CLI) and the runtime module share exactly the
 * same list, avoiding "entity not found" drift.
 */
import { Vendor } from '@modules/identity/vendor.entity';
import { User } from '@modules/identity/user.entity';
import { Membership } from '@modules/identity/membership.entity';
import { Property } from '@modules/properties/property.entity';
import { Unit } from '@modules/properties/unit.entity';
import { Lease } from '@modules/leasing/lease.entity';
import { Deposit } from '@modules/billing/deposit.entity';
import { Invoice } from '@modules/billing/invoice.entity';
import { Payment } from '@modules/billing/payment.entity';
import { LedgerEntry } from '@modules/accounting/ledger-entry.entity';
import { Account } from '@modules/accounting/account.entity';
import { Owner } from '@modules/owners/owner.entity';
import { OwnerStatement } from '@modules/owners/owner-statement.entity';
import { Payout } from '@modules/owners/payout.entity';
import { Notification } from '@modules/notifications/notification.entity';
import { NotificationPreference } from '@modules/notifications/notification-preference.entity';
import { Document } from '@modules/documents/document.entity';
import { SignatureRequest } from '@modules/documents/signature-request.entity';
import { Expense } from '@modules/expenses/expense.entity';
import { Listing } from '@modules/listings/listing.entity';
import { Application } from '@modules/listings/application.entity';
import { Inspection } from '@modules/inspections/inspection.entity';
import { Ticket } from '@modules/maintenance/ticket.entity';
import { WorkOrder } from '@modules/maintenance/work-order.entity';
import { ApiKey } from '@modules/api-keys/api-key.entity';
import { ServiceProvider } from '@modules/service-providers/service-provider.entity';
import { OtpChallenge } from '@modules/identity/otp-challenge.entity';
import { Conversation } from '@modules/comms/conversation.entity';
import { Message } from '@modules/comms/message.entity';
import { Agent } from '@modules/agents/agent.entity';
import { AgentCommission } from '@modules/agents/agent-commission.entity';
import { LeaseAgreement } from '@modules/lease-agreement/lease-agreement.entity';
import { LeaseExtractionRecord } from '@modules/lease-parsing/lease-extraction.entity';
import { ProofOfPayment } from '@modules/proof-of-payment/proof-of-payment.entity';
import { VendorSubscription } from '@modules/subscriptions/vendor-subscription.entity';
import { Partner, PartnerMember, PartnerDeal, PartnerActivity, PartnerCommission } from '@modules/partners/partner.entities';

export const ENTITIES = [
  Vendor,
  User,
  Membership,
  Property,
  Unit,
  Lease,
  Deposit,
  Invoice,
  Payment,
  LedgerEntry,
  Account,
  Owner,
  OwnerStatement,
  Payout,
  Notification,
  NotificationPreference,
  Document,
  SignatureRequest,
  Expense,
  Listing,
  Application,
  Inspection,
  Ticket,
  WorkOrder,
  ApiKey,
  ServiceProvider,
  OtpChallenge,
  Conversation,
  Message,
  Agent,
  AgentCommission,
  LeaseAgreement,
  LeaseExtractionRecord,
  ProofOfPayment,
  VendorSubscription,
  Partner,
  PartnerMember,
  PartnerDeal,
  PartnerActivity,
  PartnerCommission,
];
