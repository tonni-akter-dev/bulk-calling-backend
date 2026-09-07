const db = require("../config/db");

/* ============================================================
   GET ALL ACTIVE PLANS
============================================================ */

async function listPlans(req, res) {
  const [plans] = await db.query(`
    SELECT
      id,
      name,
      price_bdt,
      monthly_call_limit,
      max_concurrent_calls,
      is_active
    FROM plans
    WHERE is_active = 1
    ORDER BY price_bdt ASC
  `);

  res.json(plans);
}

/* ============================================================
   GET CURRENT USER'S SUBSCRIPTION
============================================================ */

async function getMySubscription(req, res) {
  const [[subscription]] = await db.query(
    `
      SELECT
        s.id,
        s.company_id,
        s.plan_id,
        s.status,
        s.calls_used_this_period,
        s.current_period_start,
        s.current_period_end,

        p.name AS plan_name,
        p.price_bdt,
        p.monthly_call_limit,
        p.max_concurrent_calls

      FROM subscriptions s

      JOIN plans p
        ON p.id = s.plan_id

      WHERE s.company_id = ?
      AND s.status = 'active'
      AND s.current_period_end > NOW()

      ORDER BY s.id DESC

      LIMIT 1
    `,
    [req.user.companyId]
  );

  res.json(subscription || null);
}

/* ============================================================
   ADMIN: GET ALL SUBSCRIPTIONS
============================================================ */

async function getAllSubscriptions(req, res) {
  // Check if user is super_admin or admin
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin only.' 
    });
  }

  const [subscriptions] = await db.query(
    `
      SELECT
        s.id,
        s.company_id,
        s.plan_id,
        s.status,
        s.calls_used_this_period,
        s.current_period_start,
        s.current_period_end,
        s.created_at,
        s.updated_at,

        p.name AS plan_name,
        p.price_bdt,
        p.monthly_call_limit,
        p.max_concurrent_calls,

        c.name AS company_name,
        c.email AS company_email,

        (
          SELECT COUNT(*) 
          FROM users 
          WHERE company_id = c.id
        ) AS user_count

      FROM subscriptions s

      JOIN plans p
        ON p.id = s.plan_id

      JOIN companies c
        ON c.id = s.company_id

      ORDER BY s.created_at DESC
    `
  );

  res.json(subscriptions);
}

/* ============================================================
   ADMIN: GET SUBSCRIPTION BY ID
   FIXED: No JSON functions, using two separate queries
============================================================ */

async function getSubscriptionById(req, res) {
  const { id } = req.params;

  // Check if user is super_admin or admin
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin only.' 
    });
  }

  // First get the subscription details
  const [subscriptionRows] = await db.query(
    `
      SELECT
        s.id,
        s.company_id,
        s.plan_id,
        s.status,
        s.calls_used_this_period,
        s.current_period_start,
        s.current_period_end,
        s.created_at,
        s.updated_at,

        p.name AS plan_name,
        p.price_bdt,
        p.monthly_call_limit,
        p.max_concurrent_calls,

        c.name AS company_name,
        c.email AS company_email

      FROM subscriptions s

      JOIN plans p
        ON p.id = s.plan_id

      JOIN companies c
        ON c.id = s.company_id

      WHERE s.id = ?
    `,
    [id]
  );

  if (subscriptionRows.length === 0) {
    return res.status(404).json({ 
      error: 'Subscription not found' 
    });
  }

  const subscription = subscriptionRows[0];

  // Then get the users for this company separately
  const [users] = await db.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role
      FROM users u
      WHERE u.company_id = ?
      ORDER BY u.created_at ASC
    `,
    [subscription.company_id]
  );

  // Combine the data
  const result = {
    ...subscription,
    users: users || []
  };

  res.json(result);
}

/* ============================================================
   ADMIN: GET SUBSCRIPTION STATISTICS
============================================================ */

async function getSubscriptionStats(req, res) {
  // Check if user is super_admin or admin
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin only.' 
    });
  }

  // Get total subscriptions
  const [totalResult] = await db.query(
    `
      SELECT COUNT(*) as total
      FROM subscriptions
      WHERE status = 'active'
    `
  );
  const totalSubscriptions = totalResult[0] || { total: 0 };

  // Get active subscriptions
  const [activeResult] = await db.query(
    `
      SELECT COUNT(*) as active
      FROM subscriptions
      WHERE status = 'active'
      AND current_period_end > NOW()
    `
  );
  const activeSubscriptions = activeResult[0] || { active: 0 };

  // Get expiring soon (within 7 days)
  const [expiringResult] = await db.query(
    `
      SELECT COUNT(*) as expiring
      FROM subscriptions
      WHERE status = 'active'
      AND current_period_end > NOW()
      AND current_period_end <= DATE_ADD(NOW(), INTERVAL 7 DAY)
    `
  );
  const expiringSoon = expiringResult[0] || { expiring: 0 };

  // Get expired subscriptions
  const [expiredResult] = await db.query(
    `
      SELECT COUNT(*) as expired
      FROM subscriptions
      WHERE status = 'active'
      AND current_period_end <= NOW()
    `
  );
  const expiredSubscriptions = expiredResult[0] || { expired: 0 };

  // Get plan distribution
  const [planDistribution] = await db.query(
    `
      SELECT
        p.name as plan_name,
        COUNT(*) as count
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
      AND s.current_period_end > NOW()
      GROUP BY p.id, p.name
      ORDER BY count DESC
    `
  );

  // Get monthly revenue for the last 12 months
  const [monthlyRevenue] = await db.query(
    `
      SELECT
        DATE_FORMAT(s.created_at, '%Y-%m') as month,
        DATE_FORMAT(s.created_at, '%b') as month_label,
        SUM(p.price_bdt) as revenue
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 11 MONTH)
      AND s.status = 'active'
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m'), DATE_FORMAT(s.created_at, '%b')
      ORDER BY month ASC
    `
  );

  res.json({
    total: totalSubscriptions.total || 0,
    active: activeSubscriptions.active || 0,
    expiringSoon: expiringSoon.expiring || 0,
    expired: expiredSubscriptions.expired || 0,
    planDistribution: planDistribution || [],
    monthlyRevenue: monthlyRevenue || []
  });
}

/* ============================================================
   CREATE SUBSCRIPTION
   TEMPORARY VERSION - NO PAYMENT
============================================================ */

async function initiateSubscription(req, res) {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({
      error: "planId is required",
    });
  }

  const [planRows] = await db.query(
    `
      SELECT * FROM plans
      WHERE id = ? AND is_active = 1
    `,
    [planId]
  );

  if (planRows.length === 0) {
    return res.status(404).json({
      error: "Plan not found",
    });
  }

  const plan = planRows[0];

  const [existingRows] = await db.query(
    `
      SELECT * FROM subscriptions
      WHERE company_id = ?
      AND status = 'active'
      AND current_period_end > NOW()
      ORDER BY id DESC
      LIMIT 1
    `,
    [req.user.companyId]
  );

  if (existingRows.length > 0) {
    return res.status(409).json({
      error: "You already have an active subscription.",
      subscription: existingRows[0],
    });
  }

  const [result] = await db.query(
    `
      INSERT INTO subscriptions (
        company_id,
        plan_id,
        status,
        calls_used_this_period,
        current_period_start,
        current_period_end
      )
      VALUES (?, ?, 'active', 0, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
    `,
    [
      req.user.companyId,
      planId,
    ]
  );

  const subscriptionId = result.insertId;

  const [subscriptionRows] = await db.query(
    `
      SELECT
        s.id,
        s.company_id,
        s.plan_id,
        s.status,
        s.calls_used_this_period,
        s.current_period_start,
        s.current_period_end,

        p.name AS plan_name,
        p.price_bdt,
        p.monthly_call_limit,
        p.max_concurrent_calls

      FROM subscriptions s

      JOIN plans p
        ON p.id = s.plan_id

      WHERE s.id = ?
    `,
    [subscriptionId]
  );

  const subscription = subscriptionRows[0];

  res.status(201).json({
    success: true,
    message: "Subscription activated successfully.",
    subscription,
  });
}

/* ============================================================
   BKASH CALLBACK - TEMPORARILY DISABLED
============================================================ */

async function bkashCallback(req, res) {
  return res.status(501).json({
    success: false,
    message: "bKash payment integration is not enabled yet.",
  });
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  listPlans,
  getMySubscription,
  getAllSubscriptions,
  getSubscriptionById,
  getSubscriptionStats,
  initiateSubscription,
  bkashCallback,
};