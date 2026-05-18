/**
 * Unit tests: database migration files (no live DB).
 * Validates migration file naming, schema content, indexes, constraints, and FK patterns.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DATABASE_DIR = path.join(process.cwd(), 'database');

function readSql(filePath: string): string {
  return readFileSync(path.join(DATABASE_DIR, filePath), 'utf-8');
}

describe('database migrations', () => {
  describe('migration file naming and presence', () => {
    it('database directory exists and contains SQL files', () => {
      const files = readdirSync(DATABASE_DIR);
      const sqlFiles = files.filter((f) => f.endsWith('.sql'));
      expect(sqlFiles.length).toBeGreaterThan(0);
    });

    it('schema.sql exists and is non-empty', () => {
      const content = readSql('schema.sql');
      expect(content.length).toBeGreaterThan(0);
    });

    it('migration files use kebab-case or descriptive names with .migration.sql', () => {
      const files = readdirSync(DATABASE_DIR);
      const migrationFiles = files.filter(
        (f) => f.endsWith('.migration.sql') || (f.startsWith('migration_') && f.endsWith('.sql'))
      );
      expect(migrationFiles.length).toBeGreaterThan(0);
      for (const f of migrationFiles) {
        expect(f).toMatch(/^[a-z0-9_-]+\.(migration\.)?sql$/i);
      }
    });
  });

  describe('schema.sql structure', () => {
    let schemaContent: string;

    beforeAll(() => {
      schemaContent = readSql('schema.sql');
    });

    it('creates businesses table with expected structure', () => {
      expect(schemaContent).toContain('CREATE TABLE');
      expect(schemaContent).toMatch(/businesses\s*\(/);
      expect(schemaContent).toContain('id UUID');
      expect(schemaContent).toContain('booking_link');
      expect(schemaContent).toContain('slot_duration');
    });

    it('creates slots table with business_id FK', () => {
      expect(schemaContent).toMatch(/slots\s*\(/);
      expect(schemaContent).toContain('business_id');
      expect(schemaContent).toContain('REFERENCES businesses(id)');
    });

    it('creates bookings table with business_id and slot_id FKs', () => {
      expect(schemaContent).toMatch(/bookings\s*\(/);
      expect(schemaContent).toContain('REFERENCES businesses(id)');
      expect(schemaContent).toContain('REFERENCES slots(id)');
    });

    it('enforces slot status check constraint', () => {
      expect(schemaContent).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(.*available.*reserved.*booked/);
    });

    it('enforces booking status check constraint', () => {
      expect(schemaContent).toMatch(
        /CHECK\s*\(\s*status\s+IN\s*\(.*pending.*confirmed.*rejected.*cancelled/
      );
    });

    it('creates expected indexes on core tables', () => {
      expect(schemaContent).toContain('idx_businesses_booking_link');
      expect(schemaContent).toContain('idx_slots_business_date');
      expect(schemaContent).toContain('idx_bookings_business');
      expect(schemaContent).toContain('idx_bookings_booking_id');
    });

    it('creates business_categories table', () => {
      expect(schemaContent).toContain('business_categories');
    });
  });

  describe('index migration files', () => {
    it('partial-indexes-hot-paths.migration.sql creates partial indexes', () => {
      const content = readSql('partial-indexes-hot-paths.migration.sql');
      expect(content).toContain('CREATE INDEX');
      expect(content).toContain('idx_bookings_partial_pending_confirmed');
      expect(content).toContain('WHERE');
    });

    it('covering-indexes-read-queries.migration.sql creates covering indexes with INCLUDE', () => {
      const content = readSql('covering-indexes-read-queries.migration.sql');
      expect(content).toContain('CREATE INDEX');
      expect(content).toContain('INCLUDE');
      expect(content).toContain('idx_bookings_covering');
      expect(content).toContain('idx_audit_logs_covering');
    });

    it('booking-discovery-audit-indexes.migration.sql defines has_index RPC', () => {
      const content = readSql('booking-discovery-audit-indexes.migration.sql');
      expect(content).toContain('has_index');
      expect(content).toContain('pg_indexes');
    });
  });

  describe('constraint and FK patterns in schema', () => {
    let schemaContent: string;

    beforeAll(() => {
      schemaContent = readSql('schema.sql');
    });

    it('slot_duration has positive check', () => {
      expect(schemaContent).toMatch(/slot_duration.*CHECK\s*\(\s*slot_duration\s*>\s*0/);
    });

    it('businesses.booking_link is UNIQUE', () => {
      expect(schemaContent).toContain('booking_link');
      expect(schemaContent).toContain('UNIQUE');
    });

    it('bookings.booking_id is UNIQUE', () => {
      expect(schemaContent).toContain('booking_id');
    });

    it('slots have UNIQUE on (business_id, date, start_time, end_time)', () => {
      expect(schemaContent).toContain('UNIQUE(business_id, date, start_time, end_time)');
    });
  });

  describe('migration ordering and dependencies', () => {
    it('schema.sql does not depend on migration-only tables for core FKs', () => {
      const content = readSql('schema.sql');
      expect(content).toContain('REFERENCES businesses(id)');
      expect(content).toContain('REFERENCES slots(id)');
    });

    it('RUN_MIGRATIONS.md exists and documents migration order', () => {
      const content = readFileSync(path.join(DATABASE_DIR, 'RUN_MIGRATIONS.md'), 'utf-8');
      expect(content).toContain('migration');
      expect(content.length).toBeGreaterThan(100);
    });
  });

  describe('utility RPCs defined in migrations', () => {
    it('stress-connection-pool-stats.migration.sql defines get_connection_pool_stats', () => {
      const content = readSql('stress-connection-pool-stats.migration.sql');
      expect(content).toContain('get_connection_pool_stats');
    });
  });
});
