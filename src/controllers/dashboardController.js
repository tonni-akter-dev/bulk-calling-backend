const db = require("../config/db");

/* ============================================================
   DASHBOARD STATS FOR ADMIN
============================================================ */

async function getDashboardStats(req, res) {
  // Check if user is super_admin or admin
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin only.' 
    });
  }

  try {
    // ============================================================
    // 1. TOTAL USERS & GROWTH
    // ============================================================
    
    const [[userStats]] = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_last_month,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_users_last_week,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as new_users_today
      FROM users
    `);

    // Get last month's user count for growth calculation
    const [[lastMonthUsers]] = await db.query(`
      SELECT COUNT(*) as total
      FROM users
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const userGrowth = lastMonthUsers.total > 0 
      ? ((userStats.total_users - lastMonthUsers.total) / lastMonthUsers.total * 100).toFixed(1)
      : 0;

    // ============================================================
    // 2. SUBSCRIPTION STATS
    // ============================================================
    
    const [[subscriptionStats]] = await db.query(`
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(CASE WHEN status = 'active' AND current_period_end > NOW() THEN 1 END) as active_subscriptions,
        COUNT(CASE WHEN status = 'active' AND current_period_end <= NOW() THEN 1 END) as expired_subscriptions,
        COUNT(CASE WHEN status = 'active' AND current_period_end > NOW() AND current_period_end <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 END) as expiring_soon
      FROM subscriptions
      WHERE status = 'active'
    `);

    // ============================================================
    // 3. MONTHLY REVENUE
    // ============================================================
    
    const [[revenueStats]] = await db.query(`
      SELECT 
        COALESCE(SUM(p.price_bdt), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN p.price_bdt ELSE 0 END), 0) as revenue_last_month
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
    `);

    // Get last month's revenue for growth calculation
    const [[lastMonthRevenue]] = await db.query(`
      SELECT COALESCE(SUM(p.price_bdt), 0) as total
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
      AND s.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const revenueGrowth = lastMonthRevenue.total > 0 
      ? ((revenueStats.revenue_last_month - lastMonthRevenue.total) / lastMonthRevenue.total * 100).toFixed(1)
      : 0;

    // ============================================================
    // 4. TOTAL CALLS
    // ============================================================
    
    const [[callStats]] = await db.query(`
      SELECT 
        COALESCE(SUM(calls_used_this_period), 0) as total_calls,
        COALESCE(SUM(CASE WHEN s.current_period_start >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN calls_used_this_period ELSE 0 END), 0) as calls_last_month
      FROM subscriptions s
      WHERE s.status = 'active'
    `);

    // ============================================================
    // 5. RECENT SUBSCRIPTIONS (Last 5)
    // ============================================================
    
    const [recentSubscriptions] = await db.query(`
      SELECT
        s.id,
        s.company_id,
        s.plan_id,
        s.status,
        s.calls_used_this_period,
        s.current_period_start,
        s.current_period_end,
        s.created_at,
        p.name AS plan_name,
        p.price_bdt,
        c.name AS company_name,
        c.email AS company_email,
        (
          SELECT name 
          FROM users 
          WHERE company_id = c.id 
          AND role = 'admin' 
          LIMIT 1
        ) AS admin_name
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      JOIN companies c ON c.id = s.company_id
      WHERE s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 5
    `);

    // ============================================================
    // 6. PLAN DISTRIBUTION
    // ============================================================
    
    const [planDistribution] = await db.query(`
      SELECT
        p.name as plan_name,
        COUNT(*) as count,
        p.price_bdt,
        p.monthly_call_limit
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
      AND s.current_period_end > NOW()
      GROUP BY p.id, p.name, p.price_bdt, p.monthly_call_limit
      ORDER BY count DESC
    `);

    // ============================================================
    // 7. MONTHLY REVENUE CHART DATA (Last 12 Months)
    // ============================================================
    
    const [monthlyRevenueChart] = await db.query(`
      SELECT
        DATE_FORMAT(s.created_at, '%b') as month,
        DATE_FORMAT(s.created_at, '%m') as month_num,
        COALESCE(SUM(p.price_bdt), 0) as revenue
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 11 MONTH)
      AND s.status = 'active'
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m'), DATE_FORMAT(s.created_at, '%b'), DATE_FORMAT(s.created_at, '%m')
      ORDER BY DATE_FORMAT(s.created_at, '%Y-%m') ASC
    `);

    // ============================================================
    // 8. RECENT USERS (Last 5)
    // ============================================================
    
    const [recentUsers] = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        c.name AS company_name
      FROM users u
      JOIN companies c ON c.id = u.company_id
      ORDER BY u.created_at DESC
      LIMIT 5
    `);

    // ============================================================
    // 9. ACTIVITY STATS
    // ============================================================
    
    // Get total companies
    const [[companyStats]] = await db.query(`
      SELECT COUNT(*) as total_companies
      FROM companies
    `);

    // Get calls this month
    const [[callsThisMonth]] = await db.query(`
      SELECT COALESCE(SUM(calls_used_this_period), 0) as calls
      FROM subscriptions s
      WHERE s.status = 'active'
      AND s.current_period_start >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // ============================================================
    // 10. ACTIVE VS EXPIRED CHART DATA
    // ============================================================
    
    const [statusDistribution] = await db.query(`
      SELECT
        'Active' as status,
        COUNT(*) as count
      FROM subscriptions
      WHERE status = 'active'
      AND current_period_end > NOW()
      UNION ALL
      SELECT
        'Expired' as status,
        COUNT(*) as count
      FROM subscriptions
      WHERE status = 'active'
      AND current_period_end <= NOW()
      UNION ALL
      SELECT
        'Expiring Soon' as status,
        COUNT(*) as count
      FROM subscriptions
      WHERE status = 'active'
      AND current_period_end > NOW()
      AND current_period_end <= DATE_ADD(NOW(), INTERVAL 7 DAY)
    `);

    // ============================================================
    // RESPONSE
    // ============================================================

    res.json({
      // Overview Stats
      overview: {
        total_users: userStats.total_users || 0,
        user_growth: parseFloat(userGrowth),
        active_subscriptions: subscriptionStats.active_subscriptions || 0,
        subscription_rate: userStats.total_users > 0 
          ? ((subscriptionStats.active_subscriptions || 0) / userStats.total_users * 100).toFixed(1)
          : 0,
        monthly_revenue: revenueStats.total_revenue || 0,
        revenue_growth: parseFloat(revenueGrowth),
        total_calls: callStats.total_calls || 0,
        total_companies: companyStats.total_companies || 0,
      },

      // User Stats
      users: {
        total: userStats.total_users || 0,
        new_today: userStats.new_users_today || 0,
        new_this_week: userStats.new_users_last_week || 0,
        new_this_month: userStats.new_users_last_month || 0,
        growth_percentage: parseFloat(userGrowth),
      },

      // Subscription Stats
      subscriptions: {
        total: subscriptionStats.total_subscriptions || 0,
        active: subscriptionStats.active_subscriptions || 0,
        expiring_soon: subscriptionStats.expiring_soon || 0,
        expired: subscriptionStats.expired_subscriptions || 0,
        status_distribution: statusDistribution,
      },

      // Revenue Stats
      revenue: {
        total: revenueStats.total_revenue || 0,
        last_month: revenueStats.revenue_last_month || 0,
        growth_percentage: parseFloat(revenueGrowth),
        monthly_chart: monthlyRevenueChart,
      },

      // Call Stats
      calls: {
        total: callStats.total_calls || 0,
        last_month: callStats.calls_last_month || 0,
        this_month: callsThisMonth.calls || 0,
      },

      // Plan Distribution
      plan_distribution: planDistribution,

      // Recent Activity
      recent: {
        subscriptions: recentSubscriptions,
        users: recentUsers,
      },

      // Timestamp
      updated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error.message 
    });
  }
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  getDashboardStats,
};