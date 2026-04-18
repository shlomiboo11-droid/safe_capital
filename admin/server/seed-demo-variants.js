/**
 * Seed 2 demo deals to showcase Active + Sold card variants on /properties.html.
 * Safe to re-run — uses ON CONFLICT to avoid duplicates.
 *
 * Run: node admin/server/seed-demo-variants.js
 * Remove: DELETE FROM deals WHERE name IN ('Elm St 4420', 'Cherry Ln 820');
 */
const pool = require('./db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── ACTIVE variant ────────────────────────────────────────────────────
    console.log('→ Seeding Active demo deal (Elm St 4420)...');
    const activeResult = await client.query(`
      INSERT INTO deals (
        deal_number, name, full_address, city, state,
        property_status, fundraising_status,
        is_featured, is_expandable, is_published, sort_order,
        thumbnail_url, description, project_duration,
        purchase_price, arv, expected_sale_price,
        fundraising_goal, min_investment, opens_at_date
      ) VALUES (
        999, 'Elm St 4420', '4420 Elm Street, Birmingham, AL 35209', 'Birmingham', 'AL',
        'purchased', 'active',
        true, true, true, -2,
        '/uploads/15/drive_1DgbNm2VRqxc3i6glMpE7X7b1ZnXy1cA3_WhatsApp_Image_2026-01-14_at_07.49.45__3_.jpeg',
        'עסקת דמו — פעילה לגיוס', '6 חודשים',
        320000, 520000, 520000,
        500000, 50000, CURRENT_DATE - INTERVAL '30 days'
      )
      ON CONFLICT (deal_number) DO UPDATE SET
        fundraising_status = EXCLUDED.fundraising_status,
        property_status = EXCLUDED.property_status,
        is_published = true,
        project_duration = EXCLUDED.project_duration,
        min_investment = EXCLUDED.min_investment,
        fundraising_goal = EXCLUDED.fundraising_goal,
        opens_at_date = EXCLUDED.opens_at_date
      RETURNING id
    `);
    const activeId = activeResult.rows[0].id;
    console.log(`  ✓ Active deal id=${activeId}`);

    // Add fake investors for raised=$375K (75% of $500K goal) + investor_count=7
    await client.query(`DELETE FROM deal_investors WHERE deal_id = $1 AND investor_name LIKE 'Demo%'`, [activeId]);
    const investors = [
      ['Demo Investor 1', 50000], ['Demo Investor 2', 50000], ['Demo Investor 3', 75000],
      ['Demo Investor 4', 50000], ['Demo Investor 5', 50000], ['Demo Investor 6', 50000],
      ['Demo Investor 7', 50000]
    ];
    for (const [name, amount] of investors) {
      await client.query(
        `INSERT INTO deal_investors (deal_id, investor_name, amount, status) VALUES ($1, $2, $3, 'funded')`,
        [activeId, name, amount]
      );
    }
    console.log(`  ✓ 7 demo investors added (raised $375K / 75%)`);

    // Ensure expected_roi_percent via deal_financials_snapshot
    await client.query(`
      INSERT INTO deal_financials_snapshot (deal_id, planned_roi)
      VALUES ($1, 20)
      ON CONFLICT (deal_id) DO UPDATE SET planned_roi = 20
    `, [activeId]);
    console.log(`  ✓ Expected ROI 20% set`);

    // ── SOLD variant ──────────────────────────────────────────────────────
    console.log('→ Seeding Sold demo deal (Cherry Ln 820)...');
    const soldResult = await client.query(`
      INSERT INTO deals (
        deal_number, name, full_address, city, state,
        property_status, fundraising_status,
        is_featured, is_expandable, is_published, sort_order,
        thumbnail_url, description, project_duration,
        purchase_price, arv, expected_sale_price,
        actual_purchase_price, actual_arv, actual_sale_price,
        fundraising_goal, min_investment,
        opens_at_date, sold_at_date, sale_completion_note
      ) VALUES (
        998, 'Cherry Ln 820', '820 Cherry Lane, Birmingham, AL 35242', 'Birmingham', 'AL',
        'sold', 'closed',
        true, true, true, -1,
        '/uploads/15/drive_1DgbNm2VRqxc3i6glMpE7X7b1ZnXy1cA3_WhatsApp_Image_2026-01-14_at_07.49.45__3_.jpeg',
        'עסקת דמו — נמכרה בהצלחה', '7 חודשים',
        220000, 360000, 360000,
        220000, 365000, 365000,
        280000, 50000,
        CURRENT_DATE - INTERVAL '210 days', CURRENT_DATE - INTERVAL '14 days',
        'הושלמה במסגרת זמנים ותקציב'
      )
      ON CONFLICT (deal_number) DO UPDATE SET
        property_status = EXCLUDED.property_status,
        fundraising_status = EXCLUDED.fundraising_status,
        is_published = true,
        actual_purchase_price = EXCLUDED.actual_purchase_price,
        actual_sale_price = EXCLUDED.actual_sale_price,
        opens_at_date = EXCLUDED.opens_at_date,
        sold_at_date = EXCLUDED.sold_at_date,
        sale_completion_note = EXCLUDED.sale_completion_note,
        project_duration = EXCLUDED.project_duration
      RETURNING id
    `);
    const soldId = soldResult.rows[0].id;
    console.log(`  ✓ Sold deal id=${soldId}`);

    // Add 5 fake investors for sold deal
    await client.query(`DELETE FROM deal_investors WHERE deal_id = $1 AND investor_name LIKE 'Demo%'`, [soldId]);
    const soldInvestors = [
      ['Demo Investor A', 56000], ['Demo Investor B', 56000],
      ['Demo Investor C', 56000], ['Demo Investor D', 56000], ['Demo Investor E', 56000]
    ];
    for (const [name, amount] of soldInvestors) {
      await client.query(
        `INSERT INTO deal_investors (deal_id, investor_name, amount, status) VALUES ($1, $2, $3, 'funded')`,
        [soldId, name, amount]
      );
    }
    console.log(`  ✓ 5 demo investors added`);

    await client.query('COMMIT');
    console.log('\n✓ Seed complete.');
    console.log('  • Active:    Elm St 4420    (id=' + activeId + ', 75% raised, 20% ROI, 6 חודשים)');
    console.log('  • Sold:      Cherry Ln 820  (id=' + soldId + ', actual ROI ~66%, 7 חודשים)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
