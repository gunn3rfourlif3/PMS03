import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prevent duplicate units: a unit label must be unique within its property
 * (case-insensitive), ignoring soft-deleted rows so a label can be reused after
 * a unit is removed. Belt to the app-layer check in PropertiesService.
 */
export class UnitLabelUnique1720000032000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS units_property_label_uniq
      ON units (property_id, lower(btrim(label)))
      WHERE deleted_at IS NULL;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS units_property_label_uniq;`);
  }
}
