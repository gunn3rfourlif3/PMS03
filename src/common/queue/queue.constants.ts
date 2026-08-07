/** Central registry of queue names + repeatable job identifiers. */
export const QUEUE_BILLING = 'billing';

export const JOB_GENERATE_RENT_INVOICES = 'generate-rent-invoices';
export const JOB_APPLY_DUNNING = 'apply-dunning';

export const QUEUE_NOTIFICATIONS = 'notifications';
export const JOB_SEND_NOTIFICATION = 'send-notification';

export const QUEUE_PARTNER = 'partner';
export const JOB_ACCRUE_COMMISSIONS = 'accrue-commissions';

export const QUEUE_SUBSCRIPTION = 'subscription';
export const JOB_GENERATE_SUB_INVOICES = 'generate-subscription-invoices';

export const QUEUE_PARTNER_APPS = 'partner-apps';
export const JOB_PURGE_REJECTED_APPS = 'purge-rejected-applications';
export const JOB_REMIND_UNFINISHED_APPS = 'remind-unfinished-applications';
