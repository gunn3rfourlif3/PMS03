import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google sign-in: link a Google account to a user. Nullable + a partial unique
 * index so a given Google `sub` maps to at most one user, while OTP-only users
 * keep google_sub NULL (many NULLs allowed).
 */
export class UserGoogleSub1720000035000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;`);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uniq
      ON users (google_sub) WHERE google_sub IS NOT NULL;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS users_google_sub_uniq;`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS google_sub;`);
  }
}
