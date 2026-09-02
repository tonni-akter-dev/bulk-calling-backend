const db = require("../config/db");

/* ============================================================
   GET ALL PLANS
============================================================ */

async function getPlans(req, res) {
  const [plans] = await db.query(`
    SELECT
      id,
      name,
      price_bdt,
      monthly_call_limit,
      max_concurrent_calls,
      is_active,
      created_at
    FROM plans
    WHERE is_active = 1
    ORDER BY price_bdt ASC
  `);

  res.json({
    success: true,
    plans,
  });
}

/* ============================================================
   GET SINGLE PLAN
============================================================ */

async function getPlan(req, res) {
  const { id } = req.params;

  const [[plan]] = await db.query(
    `
      SELECT
        id,
        name,
        price_bdt,
        monthly_call_limit,
        max_concurrent_calls,
        is_active
      FROM plans
      WHERE id = ?
      AND is_active = 1
    `,
    [id]
  );

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: "Plan not found",
    });
  }

  res.json({
    success: true,
    plan,
  });
}

module.exports = {
  getPlans,
  getPlan,
};