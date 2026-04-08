/**
 * Seed script — creates the super_admin user
 * Run: npm run seed
 */
const bcrypt = require('bcryptjs');
const pool = require('./db');

const SUPER_ADMIN = {
  email: 'admin@safecapital.co.il',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  full_name: 'Shlomi David',
  role: 'super_admin'
};

async function seed() {
  try {
    // Wait a moment for initDb() in db.js to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [SUPER_ADMIN.email]);

    if (existing.rows[0]) {
      console.log('Super admin already exists. Skipping seed.');
      process.exit(0);
    }

    const hash = await bcrypt.hash(SUPER_ADMIN.password, 12);

    await pool.query(`
      INSERT INTO users (email, password_hash, role, full_name, status, joined_at)
      VALUES ($1, $2, $3, $4, 'active', CURRENT_DATE)
    `, [SUPER_ADMIN.email, hash, SUPER_ADMIN.role, SUPER_ADMIN.full_name]);

    console.log('Super admin created successfully.');
    console.log(`  Email:    ${SUPER_ADMIN.email}`);
    console.log(`  Password: ${SUPER_ADMIN.password}`);
    console.log('  ** Change the password after first login **');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();
