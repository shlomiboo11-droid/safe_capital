const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,                        // keep low for Supabase Session mode + Vercel serverless
  idleTimeoutMillis: 10000,      // close idle connections after 10s
  connectionTimeoutMillis: 10000 // fail fast if can't connect within 10s
});

// ── Schema initialization ────────────────────────────────────────────

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('super_admin','manager','investor')),
  full_name     TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  country       TEXT,
  internal_notes TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  joined_at     DATE,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id                  SERIAL PRIMARY KEY,
  deal_number         INTEGER UNIQUE,
  name                TEXT NOT NULL,
  full_address        TEXT,
  city                TEXT,
  state               TEXT,
  zillow_url          TEXT,
  property_status     TEXT DEFAULT 'sourcing' CHECK(property_status IN ('sourcing','purchased','planning','renovation','selling','sold')),
  fundraising_status  TEXT DEFAULT 'upcoming' CHECK(fundraising_status IN ('upcoming','active','completed','closed')),
  is_featured         BOOLEAN DEFAULT FALSE,
  is_expandable       BOOLEAN DEFAULT FALSE,
  is_published        BOOLEAN DEFAULT FALSE,
  sort_order          INTEGER DEFAULT 0,
  thumbnail_url       TEXT,
  description         TEXT,
  project_duration    TEXT,
  purchase_price      NUMERIC,
  arv                 NUMERIC,
  expected_sale_price NUMERIC,
  sale_price_tooltip  TEXT,
  actual_purchase_price NUMERIC,
  actual_arv            NUMERIC,
  actual_sale_price     NUMERIC,
  fundraising_goal    NUMERIC,
  min_investment      NUMERIC,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Financial snapshot (planned values at deal creation)
CREATE TABLE IF NOT EXISTS deal_financials_snapshot (
  id                      SERIAL PRIMARY KEY,
  deal_id                 INTEGER UNIQUE NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  planned_purchase_price  NUMERIC,
  planned_arv             NUMERIC,
  planned_sale_price      NUMERIC,
  planned_total_cost      NUMERIC,
  planned_profit          NUMERIC,
  planned_roi             NUMERIC,
  snapshot_date           TIMESTAMPTZ DEFAULT NOW()
);

-- Cost categories per deal
CREATE TABLE IF NOT EXISTS deal_cost_categories (
  id          SERIAL PRIMARY KEY,
  deal_id     INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_default  BOOLEAN DEFAULT FALSE
);

-- Cost line items per category
CREATE TABLE IF NOT EXISTS deal_cost_items (
  id              SERIAL PRIMARY KEY,
  category_id     INTEGER NOT NULL REFERENCES deal_cost_categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  planned_amount  NUMERIC DEFAULT 0,
  actual_amount   NUMERIC DEFAULT 0,
  sort_order      INTEGER DEFAULT 0
);

-- Investors linked to deals
CREATE TABLE IF NOT EXISTS deal_investors (
  id                    SERIAL PRIMARY KEY,
  deal_id               INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  investor_name         TEXT NOT NULL,
  amount                NUMERIC DEFAULT 0,
  investment_date       DATE,
  ownership_percentage  NUMERIC,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Cashflow entries
CREATE TABLE IF NOT EXISTS deal_cashflow (
  id              SERIAL PRIMARY KEY,
  deal_id         INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('income','expense')),
  amount          NUMERIC NOT NULL,
  description     TEXT,
  category_id     INTEGER REFERENCES deal_cost_categories(id),
  cost_item_id    INTEGER REFERENCES deal_cost_items(id),
  funding_source  TEXT CHECK(funding_source IN ('equity','loan','sale','other')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      INTEGER REFERENCES users(id)
);

-- Before/after specs
CREATE TABLE IF NOT EXISTS deal_specs (
  id            SERIAL PRIMARY KEY,
  deal_id       INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  spec_name     TEXT NOT NULL,
  value_before  TEXT,
  value_after   TEXT,
  sort_order    INTEGER DEFAULT 0
);

-- Timeline steps
CREATE TABLE IF NOT EXISTS deal_timeline_steps (
  id          SERIAL PRIMARY KEY,
  deal_id     INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK(status IN ('completed','active','pending')),
  sort_order  INTEGER DEFAULT 0
);

-- Images
CREATE TABLE IF NOT EXISTS deal_images (
  id          SERIAL PRIMARY KEY,
  deal_id     INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  alt_text    TEXT,
  category    TEXT CHECK(category IN ('before','after','rendering','gallery','thumbnail')),
  sort_order  INTEGER DEFAULT 0
);

-- Comps
CREATE TABLE IF NOT EXISTS deal_comps (
  id                SERIAL PRIMARY KEY,
  deal_id           INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  zillow_url        TEXT,
  address           TEXT,
  sale_price        NUMERIC,
  days_on_market    INTEGER,
  bedrooms          INTEGER,
  bathrooms         NUMERIC,
  sqft              INTEGER,
  year_built        INTEGER,
  price_per_sqft    NUMERIC,
  lot_size          TEXT,
  property_type     TEXT,
  sale_date         DATE,
  image_url         TEXT,
  distance_miles    NUMERIC,
  latitude          NUMERIC,
  longitude         NUMERIC,
  similarity_score  INTEGER,
  data_source       TEXT DEFAULT 'manual',
  sort_order        INTEGER DEFAULT 0
);

-- Public documents (shown on website)
CREATE TABLE IF NOT EXISTS deal_documents (
  id          SERIAL PRIMARY KEY,
  deal_id     INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  file_url    TEXT,
  file_type   TEXT DEFAULT 'pdf',
  sort_order  INTEGER DEFAULT 0
);

-- Uploaded documents for data extraction
CREATE TABLE IF NOT EXISTS deal_uploaded_documents (
  id                  SERIAL PRIMARY KEY,
  deal_id             INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_url            TEXT,
  original_filename   TEXT,
  document_type       TEXT,
  extraction_status   TEXT DEFAULT 'pending',
  extracted_data      TEXT,
  confidence_score    NUMERIC,
  uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by         INTEGER REFERENCES users(id)
);

-- Renovation plan
CREATE TABLE IF NOT EXISTS deal_renovation_plan (
  id           SERIAL PRIMARY KEY,
  deal_id      INTEGER UNIQUE NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  total_cost   NUMERIC,
  phases_json  TEXT,
  ai_summary   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  details     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(property_status);
CREATE INDEX IF NOT EXISTS idx_cashflow_deal ON deal_cashflow(deal_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON deal_cashflow(date);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- Migrations: add funding_source to deal_cashflow (safe for existing DBs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_cashflow' AND column_name = 'funding_source'
  ) THEN
    ALTER TABLE deal_cashflow ADD COLUMN funding_source TEXT CHECK(funding_source IN ('equity','loan','sale','other'));
  END IF;
END $$;

-- Migration: add is_published to deals (safe for existing DBs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE deals ADD COLUMN is_published BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Migration: add zillow_url to deals (safe for existing DBs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'zillow_url'
  ) THEN
    ALTER TABLE deals ADD COLUMN zillow_url TEXT;
  END IF;
END $$;

-- Migration: expand deal_images category to include 'during'
DO $$ BEGIN
  ALTER TABLE deal_images DROP CONSTRAINT IF EXISTS deal_images_category_check;
  ALTER TABLE deal_images ADD CONSTRAINT deal_images_category_check
    CHECK(category IN ('before','during','after','rendering','gallery','thumbnail'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Migration: add comps_ai_analysis to deals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'comps_ai_analysis'
  ) THEN
    ALTER TABLE deals ADD COLUMN comps_ai_analysis TEXT;
  END IF;
END $$;

-- Multiple images per comp
CREATE TABLE IF NOT EXISTS deal_comp_images (
  id          SERIAL PRIMARY KEY,
  comp_id     INTEGER NOT NULL REFERENCES deal_comps(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  is_primary  BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0
);

-- Central investors table
CREATE TABLE IF NOT EXISTS investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL DEFAULT '',
  email           TEXT,
  phone           TEXT,
  phone_secondary TEXT,
  id_type         TEXT DEFAULT 'israeli_id',
  id_number       TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'ישראל',
  bank_name       TEXT,
  bank_branch     TEXT,
  bank_account    TEXT,
  company_name    TEXT,
  company_number  TEXT,
  llc_name        TEXT,
  llc_ein         TEXT,
  us_tax_id       TEXT,
  source          TEXT,
  status          TEXT DEFAULT 'lead' CHECK(status IN ('lead','active','inactive','vip')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status);
CREATE INDEX IF NOT EXISTS idx_investors_name ON investors(first_name, last_name);

-- Migration: add investor_id to deal_investors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_investors' AND column_name = 'investor_id'
  ) THEN
    ALTER TABLE deal_investors ADD COLUMN investor_id UUID REFERENCES investors(id);
    ALTER TABLE deal_investors ADD COLUMN status TEXT DEFAULT 'funded';
  END IF;
END $$;

-- Site settings (key-value, editable from admin dashboard)
CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  category    TEXT NOT NULL,
  field_type  TEXT DEFAULT 'text',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add portal fields to investors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investors' AND column_name = 'portal_username'
  ) THEN
    ALTER TABLE investors ADD COLUMN portal_username TEXT UNIQUE;
    ALTER TABLE investors ADD COLUMN portal_password_hash TEXT;
    ALTER TABLE investors ADD COLUMN portal_active BOOLEAN DEFAULT FALSE;
    ALTER TABLE investors ADD COLUMN last_login TIMESTAMPTZ;
  END IF;
END $$;

-- Notifications table for investor portal
CREATE TABLE IF NOT EXISTS investor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'update' CHECK(type IN ('update','milestone','document','financial','message')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_notifications_investor ON investor_notifications(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_notifications_unread ON investor_notifications(investor_id, is_read);

    `);
    console.log('Database schema initialized.');
  } finally {
    client.release();
  }
}

// Run schema init on startup (non-blocking — errors are logged but don't crash)
initDb().catch(err => {
  console.error('DB init error:', err.message);
});

module.exports = pool;
