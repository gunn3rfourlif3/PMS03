import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #206: partner vetting applications (KYC/KYB). PLATFORM-SCOPED (no RLS) — only
 * platform admins read them, via the app connection. PII (ID numbers, banking)
 * is app-encrypted before it reaches these jsonb columns.
 */
export class PartnerApplications1720000037000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS partner_applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type text NOT NULL,
        contact_name text,
        contact_email text NOT NULL,
        contact_phone text,
        full_name text,
        id_type text,
        residential_address text,
        company_name text,
        registration_number text,
        vat_number text,
        business_address text,
        sensitive jsonb NOT NULL DEFAULT '{}',
        banking jsonb NOT NULL DEFAULT '{}',
        documents jsonb NOT NULL DEFAULT '[]',
        risk jsonb NOT NULL DEFAULT '{}',
        agreed_terms boolean NOT NULL DEFAULT false,
        consent_at timestamptz,
        status text NOT NULL DEFAULT 'draft',
        reviewed_by uuid,
        reviewed_at timestamptz,
        decision_reason text,
        risk_notes text,
        partner_id uuid,
        upload_token_hash text,
        upload_token_expires timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS partner_applications_status_idx ON partner_applications(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS partner_applications_email_idx ON partner_applications(lower(contact_email));`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS partner_applications;`);
  }
}
