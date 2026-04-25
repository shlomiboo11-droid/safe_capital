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

-- Migration: add profit_distributed to deals (manual value for sold deals)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'profit_distributed'
  ) THEN
    ALTER TABLE deals ADD COLUMN profit_distributed NUMERIC;
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

-- Migration: add card_summary to deals (short marketing blurb for property card)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'card_summary'
  ) THEN
    ALTER TABLE deals ADD COLUMN card_summary TEXT;
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

-- Articles (Birmingham content)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'news' CHECK(category IN ('news','market','neighborhood','infrastructure')),
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  publish_date TIMESTAMPTZ,
  author TEXT DEFAULT 'צוות סייף קפיטל',
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published, publish_date);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);

-- Articles bot: extra columns for AI-generated articles with approval workflow
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary_he TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS generated_by_bot BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS approved_by_user_id INT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_references JSONB DEFAULT '[]'::jsonb;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS research_topics JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_region ON articles(region, is_published);

-- Articles bot settings (singleton row, id=1)
CREATE TABLE IF NOT EXISTS article_bot_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  frequency_cron TEXT DEFAULT '0 6 * * 0',
  allowed_sources TEXT[] DEFAULT ARRAY[
    'bloomberg.com','wsj.com','reuters.com','apnews.com','al.com',
    'nytimes.com','ft.com','calcalist.co.il','themarker.com','globes.co.il',
    'cnbc.com','marketwatch.com','bizjournals.com'
  ],
  regions TEXT[] DEFAULT ARRAY['us','birmingham','israel'],
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_note TEXT,
  last_run_articles_created INT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT article_bot_settings_singleton CHECK (id = 1)
);

INSERT INTO article_bot_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Weekly briefing
CREATE TABLE IF NOT EXISTS weekly_briefing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Static pages (editable content pages)
CREATE TABLE IF NOT EXISTS static_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_static_pages_slug ON static_pages(slug);

-- Content agent prompts
CREATE TABLE IF NOT EXISTS content_agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions(created_at DESC);

-- Event registrations (investor nights)
CREATE TABLE IF NOT EXISTS event_registrations (
  id                 SERIAL PRIMARY KEY,
  event_slug         TEXT NOT NULL DEFAULT 'may-2026-tlv',
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT NOT NULL,
  guest_name         TEXT,
  investor_type      TEXT,
  invested_before    TEXT,
  range_k            INTEGER,
  readiness          TEXT,
  source             TEXT,
  note               TEXT,
  agree_terms        BOOLEAN DEFAULT FALSE,
  subscribe_updates  BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_slug);
CREATE INDEX IF NOT EXISTS idx_event_registrations_created ON event_registrations(created_at DESC);

-- ── Investor Events (ערב משקיעים) ──────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                          SERIAL PRIMARY KEY,
  slug                        TEXT UNIQUE NOT NULL,
  is_active                   BOOLEAN DEFAULT FALSE,
  is_published                BOOLEAN DEFAULT FALSE,

  -- Hero
  hero_eyebrow_location       TEXT,
  hero_eyebrow_session        TEXT,
  hero_title_main             TEXT,
  hero_title_accent           TEXT,
  hero_description            TEXT,
  hero_image_url              TEXT,

  -- Event core
  event_date                  DATE,
  event_time_start            TEXT,
  event_time_end              TEXT,
  event_date_display_full     TEXT,
  event_date_display_short    TEXT,

  -- Venue
  venue_name                  TEXT,
  venue_address               TEXT,
  venue_short                 TEXT,
  venue_full_address          TEXT,

  -- Capacity
  seats_total                 INT DEFAULT 40,
  seats_taken                 INT DEFAULT 0,

  -- Investment info
  min_investment_display      TEXT DEFAULT '$50,000',
  roi_target_display          TEXT DEFAULT 'עד 20%',
  roi_spec                    TEXT DEFAULT 'שנתי · ברוטו',
  holding_period              TEXT DEFAULT '6-12 חודשים',

  -- Brief
  brief_text                  TEXT,

  -- Track record section title
  track_record_title          TEXT DEFAULT 'העסקאות שלנו',
  track_record_subtitle       TEXT DEFAULT 'TRACK RECORD',

  -- WhatsApp / Calendar
  whatsapp_number             TEXT DEFAULT '972547828550',
  gcal_title                  TEXT,
  gcal_description            TEXT,

  -- JSON sub-entities
  agenda                      JSONB DEFAULT '[]'::jsonb,
  speakers                    JSONB DEFAULT '[]'::jsonb,
  faqs                        JSONB DEFAULT '[]'::jsonb,

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Only one event can be is_active = true at any time
CREATE UNIQUE INDEX IF NOT EXISTS events_one_active
  ON events (is_active) WHERE is_active = TRUE;

-- Featured deals join table
CREATE TABLE IF NOT EXISTS event_featured_deals (
  id                          SERIAL PRIMARY KEY,
  event_id                    INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  deal_id                     INT REFERENCES deals(id) ON DELETE SET NULL,
  fallback_address            TEXT,
  fallback_deal_number        TEXT,
  fallback_raised_display     TEXT,
  fallback_investor_count     INT,
  fallback_roi_display        TEXT,
  sort_order                  INT DEFAULT 0,
  override_status_label       TEXT,
  override_status_tone        TEXT,
  override_note               TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_featured_deals_event ON event_featured_deals(event_id);

-- Migration: add is_hidden to event_featured_deals (hide auto-pulled deals per event)
ALTER TABLE event_featured_deals ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Migration: add event_id to event_registrations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_registrations' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE event_registrations ADD COLUMN event_id INT REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);

-- Migration: add total_cost_manual_override to deal_renovation_plan
-- When TRUE, total_cost is frozen at a manually-entered value.
-- When FALSE (default), total_cost auto-syncs as sum of phase costs.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_renovation_plan' AND column_name = 'total_cost_manual_override'
  ) THEN
    ALTER TABLE deal_renovation_plan ADD COLUMN total_cost_manual_override BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

    `);
    console.log('Database schema initialized.');
  } finally {
    client.release();
  }
}

// Run schema init on startup — skip on Vercel serverless (tables already exist)
if (process.env.VERCEL !== '1') {
  initDb().catch(err => {
    console.error('DB init error:', err.message);
  });
}

module.exports = pool;
