/**
 * Portal authentication middleware
 * Verifies JWT tokens issued for investor portal access.
 * Separate from admin auth — investors have their own JWT.
 */
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'safe-capital-secret-key';

function portalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'נדרשת התחברות' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Portal tokens have investor_id and type='portal'
    if (decoded.type !== 'portal') {
      return res.status(403).json({ error: 'אין הרשאה לפורטל' });
    }
    req.investor = {
      id: decoded.investor_id,
      first_name: decoded.first_name
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'טוקן לא תקין או שפג תוקפו' });
  }
}

module.exports = { portalAuthenticate };
