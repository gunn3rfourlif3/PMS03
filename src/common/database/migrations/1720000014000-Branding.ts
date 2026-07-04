import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * White-label branding.
 *  - vendors.slug: public, URL-safe key the apps use to fetch their theme.
 *  - vendors.config->'branding': the theme blob (colors, font, logo, contact).
 *  - public_branding(text): SECURITY DEFINER lookup by slug OR custom_domain,
 *    used by the unauthenticated GET /branding/:slug endpoint.
 *
 * Seeds two contrasting brands so a single slug change re-skins the whole app:
 *   demo    -> Demo Agency     (teal, system font)
 *   rivonia -> Rivonia Rentals (navy, Poppins)  + an owner login to view it.
 */
export class Branding1720000014000 implements MigrationInterface {
  name = 'Branding1720000014000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "slug" varchar;`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_vendors_slug" ON "vendors" ("slug") WHERE "slug" IS NOT NULL;`,
    );

    const demoBranding = {
      tagline: 'Property management, simplified.',
      logo: { text: 'Demo Agency' },
      colors: {
        brand: '#0F6E56', onBrand: '#ffffff', tint: '#E1F5EE', accent: '#C9A227',
        ink: '#16181d', muted: '#6b7280', line: '#e5e7eb', bg: '#f6f7f6', card: '#ffffff',
        danger: '#993C1D', dangerBg: '#FAECE7', success: '#0F6E56',
      },
      font: { family: 'System', headingFamily: 'System' },
      contact: {
        email: 'hello@demoagency.co.za', phone: '+27 11 000 0000',
        website: 'demoagency.co.za', address: '12 Rivonia Rd, Sandton',
      },
    };

    const rivoniaBranding = {
      tagline: 'Rentals done right.',
      logo: { text: 'Rivonia Rentals' },
      colors: {
        brand: '#1B2A4A', onBrand: '#ffffff', tint: '#E7ECF5', accent: '#E08A1E',
        ink: '#12151c', muted: '#66707f', line: '#e6e8ec', bg: '#f4f5f7', card: '#ffffff',
        danger: '#B23A3A', dangerBg: '#F7E9E9', success: '#1E7A54',
      },
      font: {
        family: 'Poppins', headingFamily: 'Poppins',
        webUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
      },
      contact: {
        email: 'support@rivoniarentals.co.za', phone: '+27 10 555 0100',
        website: 'rivoniarentals.co.za', address: '5 Fredman Dr, Sandton',
      },
    };

    // Tag the existing demo vendor + attach its branding.
    await q.query(
      `UPDATE "vendors"
         SET "slug" = 'demo',
             "config" = COALESCE("config", '{}'::jsonb) || jsonb_build_object('branding', $1::jsonb)
       WHERE "name" = 'Demo Agency';`,
      [JSON.stringify(demoBranding)],
    );

    // Second sample brand (idempotent) + an owner login so its themed app is usable.
    const existing = await q.query(`SELECT id FROM vendors WHERE slug = 'rivonia' LIMIT 1;`);
    if (existing.length === 0) {
      const [v] = await q.query(
        `INSERT INTO vendors (name, slug, type, default_currency, has_valid_ffc, has_trust_account, config)
         VALUES ('Rivonia Rentals', 'rivonia', 'agency', 'ZAR', true, true, jsonb_build_object('branding', $1::jsonb))
         RETURNING id;`,
        [JSON.stringify(rivoniaBranding)],
      );
      const [u] = await q.query(
        `INSERT INTO users (name, email, phone) VALUES ('Rivonia Owner', 'owner@rivonia.test', '+27820000002')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id;`,
      );
      await q.query(
        `INSERT INTO memberships (vendor_id, user_id, role, scope) VALUES ($1, $2, 'vendor_owner', '{}');`,
        [v.id, u.id],
      );
    }

    await q.query(`
      CREATE OR REPLACE FUNCTION public_branding(p_key text)
      RETURNS json
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT json_build_object('name', name, 'slug', slug, 'branding', config->'branding')
        FROM vendors
        WHERE status = 'active' AND (slug = p_key OR custom_domain = p_key)
        LIMIT 1;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS public_branding(text);`);
    await q.query(`DELETE FROM memberships WHERE vendor_id IN (SELECT id FROM vendors WHERE slug = 'rivonia');`);
    await q.query(`DELETE FROM vendors WHERE slug = 'rivonia';`);
    await q.query(`DROP INDEX IF EXISTS "uq_vendors_slug";`);
    await q.query(`ALTER TABLE "vendors" DROP COLUMN IF EXISTS "slug";`);
  }
}
