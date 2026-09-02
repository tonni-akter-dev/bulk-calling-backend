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
   GET CURRENT SUBSCRIPTION
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
   CREATE SUBSCRIPTION
   TEMPORARY VERSION - NO PAYMENT
============================================================ */

async function initiateSubscription(req, res) {
  const { planId } = req.body;

  /* ----------------------------------------------------------
     Validate plan ID
  ---------------------------------------------------------- */

  if (!planId) {
    return res.status(400).json({
      error: "planId is required",
    });
  }

  /* ----------------------------------------------------------
     Find plan
  ---------------------------------------------------------- */

  const [[plan]] = await db.query(
    `
      SELECT *
      FROM plans
      WHERE id = ?
      AND is_active = 1
    `,
    [planId]
  );

  if (!plan) {
    return res.status(404).json({
      error: "Plan not found",
    });
  }

  /* ----------------------------------------------------------
     Check existing active subscription
  ---------------------------------------------------------- */

  const [[existingSubscription]] = await db.query(
    `
      SELECT *
      FROM subscriptions
      WHERE company_id = ?
      AND status = 'active'
      AND current_period_end > NOW()
      ORDER BY id DESC
      LIMIT 1
    `,
    [req.user.companyId]
  );

  if (existingSubscription) {
    return res.status(409).json({
      error: "You already have an active subscription.",
      subscription: existingSubscription,
    });
  }

  /* ----------------------------------------------------------
     Create subscription
     
     PAYMENT TEMPORARILY DISABLED
     
     Later we will:
     
     1. Create bKash payment
     2. Redirect user to bKash
     3. Wait for callback
     4. Verify payment
     5. Activate subscription
     
     For now we directly activate it.
  ---------------------------------------------------------- */

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

  /* ----------------------------------------------------------
     Get created subscription
  ---------------------------------------------------------- */

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

      WHERE s.id = ?
    `,
    [subscriptionId]
  );

  /* ----------------------------------------------------------
     RESPONSE
  ---------------------------------------------------------- */

  res.status(201).json({
    success: true,
    message: "Subscription activated successfully.",
    subscription,
  });
}

/* ============================================================
   BKASH CALLBACK
   TEMPORARILY DISABLED
============================================================ */

async function bkashCallback(req, res) {
  /*
    ============================================================
    bKash PAYMENT WILL BE IMPLEMENTED LATER
    ============================================================

    const { paymentID, status } = req.query;

    // Find payment
    // Execute bKash payment
    // Verify transaction
    // Activate subscription
  */

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
  initiateSubscription,
  bkashCallback,
};