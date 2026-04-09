/**
 * Migration: Create investor records from existing deal_investors data.
 * Maps existing investor_name entries to the new investors table,
 * then links them via investor_id.
 *
 * Safe to re-run — skips records that already have investor_id.
 */
const pool = require('./db');

// Manual mapping: investor_name → normalized { first_name, last_name }
// "שלומי" (deal 15) and "שלומי דוד" (deal 16) are the same person
const NAME_OVERRIDES = {
  'שלומי': { first_name: 'שלומי', last_name: 'דוד' },
  'שלומי דוד': { first_name: 'שלומי', last_name: 'דוד' },
};

function parseName(investorName) {
  if (NAME_OVERRIDES[investorName]) return NAME_OVERRIDES[investorName];
  const parts = investorName.trim().split(/\s+/);
  return {
    first_name: parts[0] || investorName,
    last_name: parts.slice(1).join(' ') || '',
  };
}

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Get all deal_investors that don't have investor_id yet
    const { rows: existing } = await client.query(
      `SELECT id, investor_name FROM deal_investors WHERE investor_id IS NULL ORDER BY id`
    );

    if (existing.length === 0) {
      console.log('No unmigrated deal_investors found. Nothing to do.');
      return;
    }

    console.log(`Found ${existing.length} deal_investors to migrate.`);

    await client.query('BEGIN');

    // 2. Group by normalized name to find unique investors
    const investorMap = {}; // "first_name|last_name" → investor UUID
    let created = 0;
    let linked = 0;

    for (const row of existing) {
      const { first_name, last_name } = parseName(row.investor_name);
      const key = `${first_name}|${last_name}`;

      // Create investor if not already created in this run
      if (!investorMap[key]) {
        // Check if investor already exists in DB (from previous partial run)
        const check = await client.query(
          `SELECT id FROM investors WHERE first_name = $1 AND last_name = $2 LIMIT 1`,
          [first_name, last_name]
        );

        if (check.rows.length > 0) {
          investorMap[key] = check.rows[0].id;
          console.log(`  Found existing: ${first_name} ${last_name} → ${investorMap[key]}`);
        } else {
          const ins = await client.query(
            `INSERT INTO investors (first_name, last_name, status) VALUES ($1, $2, 'active') RETURNING id`,
            [first_name, last_name]
          );
          investorMap[key] = ins.rows[0].id;
          created++;
          console.log(`  Created: ${first_name} ${last_name} → ${investorMap[key]}`);
        }
      }

      // 3. Link deal_investors row to investor
      await client.query(
        `UPDATE deal_investors SET investor_id = $1 WHERE id = $2`,
        [investorMap[key], row.id]
      );
      linked++;
    }

    await client.query('COMMIT');
    console.log(`\nMigration complete: ${created} investors created, ${linked} deal_investors linked.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
