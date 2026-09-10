/**
 * push.js — הרשמה והסרה של מכשיר להתראות.
 *
 * כל הנתיבים דורשים התחברות: רק מנהל מחובר יכול לרשום מכשיר, וכל מנוי
 * נשמר עם ה-user שלו. המפתח הציבורי מוגש מכאן ולא מוטמע ב-JS של הדף,
 * כדי שהחלפת מפתחות תהיה שינוי סביבה אחד ולא עריכת קוד.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const push = require('../services/push');

const router = express.Router();
router.use(authenticate);

// GET /api/push/public-key — המפתח הציבורי + האם השירות מוגדר בכלל
router.get('/public-key', (req, res) => {
  res.json({ key: push.publicKey(), configured: push.isConfigured() });
});

// GET /api/push/status?endpoint=… — האם המכשיר הזה כבר רשום
router.get('/status', async (req, res) => {
  try {
    res.json({
      configured: push.isConfigured(),
      subscribed: await push.hasSubscription(req.query.endpoint),
      devices: await push.countSubscriptions(req.user.id)
    });
  } catch (err) {
    console.error('Push status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/push/subscribe — { subscription: PushSubscriptionJSON }
router.post('/subscribe', async (req, res) => {
  try {
    const row = await push.saveSubscription(
      req.user.id, req.body.subscription, req.headers['user-agent']
    );
    res.json({ success: true, id: row.id });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/push/unsubscribe — { endpoint }
router.post('/unsubscribe', async (req, res) => {
  try {
    const removed = await push.removeSubscription(req.body.endpoint);
    res.json({ success: true, removed });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/push/test — התראת בדיקה למכשירים של המשתמש הנוכחי
router.post('/test', async (req, res) => {
  try {
    const result = await push.sendToAll({
      title: 'ההתראות עובדות',
      body: 'זו התראת בדיקה מהאדמין פאנל של Safe Capital.',
      url: '/leads',
      tag: 'test'
    }, { userId: req.user.id });
    res.json(result);
  } catch (err) {
    console.error('Push test error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
