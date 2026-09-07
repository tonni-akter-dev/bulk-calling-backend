const jwt = require('jsonwebtoken');

// Role-based access control middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, companyId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Super Admin only middleware
function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Super Admin only.' });
  }
  next();
}

// Admin only middleware (includes super_admin)
function requireAdmin(req, res, next) {
  if (req.user.role !== 'user' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
}

// Blocks access to campaign actions if the company has no active, unexpired subscription
async function requireActiveSubscription(req, res, next) {
  const db = require('../config/db');
  const [rows] = await db.query(
    `SELECT * FROM subscriptions 
     WHERE company_id = ? AND status = 'active' AND current_period_end > NOW() 
     ORDER BY id DESC LIMIT 1`,
    [req.user.companyId]
  );
  if (!rows.length) {
    return res.status(402).json({ error: 'No active subscription. Please subscribe or renew your plan.' });
  }
  req.subscription = rows[0];
  next();
}

module.exports = { 
  requireAuth, 
  requireSuperAdmin, 
  requireAdmin,
  requireActiveSubscription 
};