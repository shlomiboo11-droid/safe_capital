/**
 * mercury.js — נתוני בנק מ-Mercury לאדמין. קריאה בלבד.
 *
 * כל הנתיבים דורשים התחברות בתפקיד super_admin או manager. משקיע לא רואה כלום כאן.
 * הטוקנים של Mercury לעולם לא יוצאים מהשרת: הדפדפן מדבר רק עם הנתיבים האלה.
 *
 * לכל נתיב אפשר להוסיף ?org=haruv (או eas) כדי לקבל ארגון אחד. בלי org מקבלים
 * את כל הארגונים יחד, וכל רשומה נושאת שדה org שאומר מאיפה היא הגיעה.
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const mercury = require('../services/mercury');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

function fail(res, err, label) {
  console.error(`Mercury ${label} error:`, err.message);
  const status = err.status === 401 || err.status === 403 ? 502 : (err.status || 500);
  res.status(status).json({ error: err.message });
}

// GET /api/mercury/status — אילו ארגונים מוגדרים, והאם כל אחד מהם עונה
router.get('/status', async (req, res) => {
  const keys = mercury.orgKeys();
  if (keys.length === 0) {
    return res.json({ configured: false, orgs: [] });
  }
  const orgs = await Promise.all(keys.map(async (key) => {
    try {
      const accounts = await mercury.getAccounts(key);
      return { org: key, connected: true, accounts: accounts.length };
    } catch (err) {
      return { org: key, connected: false, error: err.message };
    }
  }));
  res.json({ configured: true, orgs });
});

// GET /api/mercury/accounts?org= — חשבונות ויתרות
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await mercury.acrossOrgs(req.query.org, k => mercury.getAccounts(k));
    res.json({
      accounts: accounts.map(a => ({
        org: a.org,
        id: a.id,
        name: a.name,
        nickname: a.nickname || null,
        kind: a.kind,
        status: a.status,
        currentBalance: a.currentBalance,
        availableBalance: a.availableBalance
      }))
    });
  } catch (err) {
    fail(res, err, 'accounts');
  }
});

// GET /api/mercury/transactions?org=&start=YYYY-MM-DD&end=YYYY-MM-DD&status=&accountId=&search=
router.get('/transactions', async (req, res) => {
  try {
    const { org, start, end, status, accountId, search } = req.query;
    const transactions = await mercury.acrossOrgs(org,
      k => mercury.getTransactions(k, { start, end, status, accountId, search }));
    transactions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({
      count: transactions.length,
      transactions: transactions.map(t => ({
        org: t.org,
        id: t.id,
        accountId: t.accountId,
        amount: t.amount,
        status: t.status,
        kind: t.kind,
        counterpartyName: t.counterpartyName,
        bankDescription: t.bankDescription || null,
        note: t.note || null,
        createdAt: t.createdAt,
        postedAt: t.postedAt || null
      }))
    });
  } catch (err) {
    fail(res, err, 'transactions');
  }
});

// GET /api/mercury/transactions/:id?org=haruv — תנועה מלאה. org חובה כאן, כי ה-ID שייך לארגון אחד.
router.get('/transactions/:id', async (req, res) => {
  if (!req.query.org) {
    return res.status(400).json({ error: 'חסר פרמטר org' });
  }
  try {
    res.json(await mercury.getTransaction(req.query.org, req.params.id));
  } catch (err) {
    fail(res, err, 'transaction');
  }
});

// GET /api/mercury/cashflow?org=&start=&end=&accountId= — סיכום חודשי ולפי חשבון
router.get('/cashflow', async (req, res) => {
  try {
    const { org, start, end, accountId } = req.query;
    const [transactions, accounts] = await Promise.all([
      mercury.acrossOrgs(org, k => mercury.getTransactions(k, { start, end, accountId })),
      mercury.acrossOrgs(org, k => mercury.getAccounts(k))
    ]);
    const summary = mercury.summarizeCashflow(transactions);
    const names = Object.fromEntries(accounts.map(a => [a.id, a.nickname || a.name]));
    summary.accounts = summary.accounts.map(a => ({ ...a, name: names[a.accountId] || a.accountId }));
    res.json({
      range: { start: start || null, end: end || null },
      orgs: org ? [org] : mercury.orgKeys(),
      transactions: transactions.length,
      ...summary
    });
  } catch (err) {
    fail(res, err, 'cashflow');
  }
});

module.exports = router;
