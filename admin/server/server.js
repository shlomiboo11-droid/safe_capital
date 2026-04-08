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
  contentSecurityPolicy: false   // Admin is internal — inline scripts + CDN are safe here
}));
app.use(cors({
  origin: [
    process.env.ADMIN_ORIGIN || 'http://localhost:3000',
    'http://localhost:8081'
  ]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' }
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

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  // Don't catch API calls
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  // Serve the appropriate HTML file based on path
  const htmlFiles = {
    '/login': 'login.html',
    '/users': 'users.html',
    '/deal-wizard': 'deal-wizard.html',
    '/deal': 'deal.html',
  };

  for (const [prefix, file] of Object.entries(htmlFiles)) {
    if (req.path.startsWith(prefix)) {
      return res.sendFile(path.join(__dirname, '..', 'public', file));
    }
  }

  // Default: deal list (dashboard home)
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Safe Capital Admin Dashboard running on http://localhost:${PORT}`);
  console.log(`  Login:  http://localhost:${PORT}/login`);
  console.log(`  Admin:  http://localhost:${PORT}/`);
});
