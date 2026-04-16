const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

// Initialize database (creates tables on first run)
require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: [
    process.env.ADMIN_ORIGIN || 'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:8082',
    'https://safe-capital-il.vercel.app',
    'https://safecapital.vercel.app',
    'https://safecapital.co.il',
    'https://www.safecapital.co.il'
  ]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiter for admin login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

// Rate limiter for portal login (separate from admin)
const portalLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות' }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve website images (logo etc.) so admin pages can reference /images/logo.svg
app.use('/images', express.static(path.join(__dirname, '..', '..', 'website', 'images')));

// Public API routes — registered BEFORE auth middleware so no token is required
app.use('/api/public', require('./routes/public'));

// API Routes
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/deals', require('./routes/deal-financials'));
app.use('/api/deals', require('./routes/deal-cashflow'));
app.use('/api/deals', require('./routes/deal-sub-entities'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/extract', require('./routes/extract'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/google-drive', require('./routes/google-drive'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/investors', require('./routes/investors'));
app.use('/api/content', require('./routes/content'));

// Portal routes (investor-facing, separate auth)
const portalRouter = require('./routes/portal');
app.use('/api/portal/login', portalLoginLimiter);
app.use('/api/portal', portalRouter);

// Investors portal: redirect root to /portal/ when accessed via investors subdomain
app.get('/', (req, res, next) => {
  if (req.hostname && req.hostname.includes('investors')) {
    return res.redirect('/portal/');
  }
  next();
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  // Don't catch API calls
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }

  // Portal routes — serve portal HTML files
  if (req.path.startsWith('/portal/')) {
    const portalFile = req.path.replace('/portal/', '') || 'index.html';
    // Only serve known HTML files, let static middleware handle assets
    if (portalFile.endsWith('.html') || portalFile === '' || !portalFile.includes('.')) {
      const htmlFile = portalFile.endsWith('.html') ? portalFile : portalFile + '.html';
      return res.sendFile(path.join(__dirname, '..', 'public', 'portal', htmlFile), (err) => {
        if (err) res.sendFile(path.join(__dirname, '..', 'public', 'portal', 'index.html'));
      });
    }
  }

  // Serve the appropriate HTML file based on path
  const htmlFiles = {
    '/login': 'login.html',
    '/users': 'users.html',
    '/deal-wizard': 'deal-wizard.html',
    '/deal': 'deal.html',
    '/settings': 'settings.html',
    '/investors': 'investors.html',
    '/investor': 'investor.html',
    '/articles': 'articles.html',
    '/article-edit': 'article-edit.html',
    '/weekly-briefing': 'weekly-briefing.html',
    '/content-pages': 'content-pages.html',
    '/content-agents': 'content-agents.html',
  };

  for (const [prefix, file] of Object.entries(htmlFiles)) {
    if (req.path.startsWith(prefix)) {
      return res.sendFile(path.join(__dirname, '..', 'public', file));
    }
  }

  // Default: deal list (dashboard home)
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler — always return JSON, never HTML
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
  next(err);
});

// For local dev: start server
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Safe Capital Admin Dashboard running on http://localhost:${PORT}`);
    console.log(`  Login:  http://localhost:${PORT}/login`);
    console.log(`  Admin:  http://localhost:${PORT}/`);
  });
}

// For Vercel: export the Express app with extended timeout for AI extraction
module.exports = app;
module.exports.config = { maxDuration: 60 };
