const pool = require('../db');

/**
 * Log an action to the audit trail
 * @param {number} userId - Who performed the action
 * @param {string} action - create/update/delete
 * @param {string} entityType - deal/cashflow/user/document/...
 * @param {number} entityId - ID of the affected entity
 * @param {object} details - What changed (will be JSON-stringified)
 */
async function logAudit(userId, action, entityType, entityId, details = null) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Audit failures should never crash the request
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };
