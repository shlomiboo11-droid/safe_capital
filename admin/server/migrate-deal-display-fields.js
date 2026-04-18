/**
 * Migration: Add investor-facing display fields to deals + create deal_waitlist table.
 *
 * Adds columns to `deals`:
 *   - opens_at_date                 DATE
 *   - sold_at_date                  DATE
 *   - renovation_progress_percent   NUMERIC (0..100)
 *   - sale_completion_note          TEXT
 *
 * Creates:
 *   - deal_waitlist table + index on deal_id
 *
 * Idempotent — uses IF NOT EXISTS everywhere. Safe to re-run.
 */
const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('→ Starting deal display fields migration...');

    await client.query('BEGIN');

    // 1. Add new columns to deals
    console.log('  • Adding columns to deals table...');
    await client.query(`
      ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS opens_at_date DATE,
        ADD COLUMN IF NOT EXISTS sold_at_date DATE,
        ADD COLUMN IF NOT EXISTS renovation_progress_percent NUMERIC
          CHECK (renovation_progress_percent IS NULL OR (renovation_progress_percent >= 0 AND renovation_progress_percent <= 100)),
        ADD COLUMN IF NOT EXISTS sale_completion_note TEXT
    `);
    console.log('    ✓ deals columns ensured');

    // 2. Create deal_waitlist table
    console.log('  • Creating deal_waitlist table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS deal_waitlist (
        id SERIAL PRIMARY KEY,
        deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
        email TEXT,
        phone TEXT,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(deal_id, investor_id),
        CHECK (investor_id IS NOT NULL OR email IS NOT NULL)
      )
    `);
    console.log('    ✓ deal_waitlist table ensured');

    // 3. Index on deal_id for fast lookups
    console.log('  • Creating index idx_deal_waitlist_deal_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deal_waitlist_deal_id ON deal_waitlist(deal_id)
    `);
    console.log('    ✓ index ensured');

    await client.query('COMMIT');
    console.log('\n✓ Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Migration error:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
