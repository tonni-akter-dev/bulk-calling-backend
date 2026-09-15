const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

// ============================================================
// Helper — Phone normalize
// ============================================================
function normalizePhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[\s\-().]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : null;
}

// ============================================================
// Super Admin creates a new user (company admin)
// ============================================================
async function createUser(req, res) {
  const {
    companyName,
    name,
    email,
    password,
    phone = null,
    role = "user",
  } = req.body;

  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Only Super Admin can create users",
    });
  }

  if (!companyName || !name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "companyName, name, email, password are required",
    });
  }

  const normalizedPhone = normalizePhone(phone);

  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);
  if (existing.length) {
    return res.status(409).json({
      success: false,
      error: "Email already registered",
    });
  }

  if (normalizedPhone) {
    const [phoneExists] = await db.query(
      "SELECT id FROM users WHERE phone = ?",
      [normalizedPhone]
    );
    if (phoneExists.length) {
      return res.status(409).json({
        success: false,
        error: "Phone number already registered",
      });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let [companyRows] = await conn.query(
      "SELECT id FROM companies WHERE name = ? OR email = ?",
      [companyName, email]
    );
    let companyId;

    if (companyRows.length) {
      companyId = companyRows[0].id;
    } else {
      const [companyResult] = await conn.query(
        "INSERT INTO companies (name, email) VALUES (?, ?)",
        [companyName, email]
      );
      companyId = companyResult.insertId;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      `INSERT INTO users
         (company_id, name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, name, email, normalizedPhone, passwordHash, role]
    );

    await conn.commit();

    const userId = userResult.insertId;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: userId,
        name,
        email,
        phone: normalizedPhone,
        role,
        companyId,
        companyName,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("createUser error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to create user",
    });
  } finally {
    conn.release();
  }
}

// ============================================================
// Regular user signup
// ============================================================
async function signup(req, res) {
  const { companyName, name, email, phone = null, password } = req.body;

  if (!companyName || !name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "companyName, name, email, password are required",
    });
  }

  const normalizedPhone = normalizePhone(phone);

  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);
  if (existing.length) {
    return res.status(409).json({
      success: false,
      error: "Email already registered",
    });
  }

  if (normalizedPhone) {
    const [phoneExists] = await db.query(
      "SELECT id FROM users WHERE phone = ?",
      [normalizedPhone]
    );
    if (phoneExists.length) {
      return res.status(409).json({
        success: false,
        error: "Phone number already registered",
      });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [companyResult] = await conn.query(
      "INSERT INTO companies (name, email) VALUES (?, ?)",
      [companyName, email]
    );
    const companyId = companyResult.insertId;

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      `INSERT INTO users
         (company_id, name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?, "admin")`,
      [companyId, name, email, normalizedPhone, passwordHash]
    );

    await conn.commit();

    const userId = userResult.insertId;
    const role = "admin";

    const token = jwt.sign(
      { userId, companyId, role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Signup successful",
      token,
      user: {
        id: userId,
        name,
        email,
        phone: normalizedPhone,
        role,
        companyId,
        companyName,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("signup error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Signup failed",
    });
  } finally {
    conn.release();
  }
}

// ============================================================
// Login for all users
// ============================================================
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  const [rows] = await db.query(
    `SELECT 
       u.id, u.name, u.email, u.phone, u.password_hash, u.role,
       u.company_id, c.name AS company_name
     FROM users u
     JOIN companies c ON u.company_id = c.id
     WHERE u.email = ?`,
    [email]
  );

  if (!rows.length) {
    return res.status(401).json({
      success: false,
      error: "Invalid credentials",
    });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({
      success: false,
      error: "Invalid credentials",
    });
  }

  const token = jwt.sign(
    { userId: user.id, companyId: user.company_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
    },
  });
}

// ============================================================
// GET /api/auth/me — Current user profile
// ============================================================
async function getMe(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT 
         u.id,
         u.name,
         u.email,
         u.phone,
         u.role,
         u.company_id,
         c.name AS company_name
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`,
      [req.user.userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// ============================================================
// PUT /api/auth/update-profile — Update user profile + company name
// ============================================================
async function updateProfile(req, res) {
  try {
    const { name, email, phone, company_name } = req.body;

    // ── Validate required fields ──
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    // ── Get current user (need company_id) ──
    const [[currentUser]] = await db.query(
      `SELECT id, company_id, email FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // ── Phone duplicate check ──
    if (normalizedPhone) {
      const [phoneExists] = await db.query(
        `SELECT id FROM users WHERE phone = ? AND id != ?`,
        [normalizedPhone, req.user.userId]
      );
      if (phoneExists.length) {
        return res.status(409).json({
          success: false,
          message: "Phone number already in use",
        });
      }
    }

    // ── Email duplicate check (if email provided) ──
    if (email && email.trim()) {
      const [emailExists] = await db.query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email.trim(), req.user.userId]
      );
      if (emailExists.length) {
        return res.status(409).json({
          success: false,
          message: "Email already in use by another account",
        });
      }

      // Update email too
      await db.query(
        `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
        [name.trim(), email.trim(), normalizedPhone, req.user.userId]
      );
    } else {
      // Email not provided — keep existing
      await db.query(
        `UPDATE users SET name = ?, phone = ? WHERE id = ?`,
        [name.trim(), normalizedPhone, req.user.userId]
      );
    }

    // ── Update company name (if provided) ──
    if (company_name && company_name.trim()) {
      const trimmedCompany = company_name.trim();

      // Check duplicate company name (other than self)
      const [dupCompany] = await db.query(
        `SELECT id FROM companies WHERE name = ? AND id != ?`,
        [trimmedCompany, currentUser.company_id]
      );

      if (dupCompany.length) {
        return res.status(409).json({
          success: false,
          message: "Company name already in use",
        });
      }

      await db.query(`UPDATE companies SET name = ? WHERE id = ?`, [
        trimmedCompany,
        currentUser.company_id,
      ]);
    }

    // ── Return fresh user data ──
    const [rows] = await db.query(
      `SELECT 
         u.id, u.name, u.email, u.phone, u.role,
         u.company_id, c.name AS company_name
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: rows[0],
    });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// ============================================================
// GET /api/auth/users — Get all users (Super Admin only)
// ============================================================
async function getAllUsers(req, res) {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Only Super Admin can view all users",
    });
  }

  const [rows] = await db.query(
    `SELECT 
       u.id, u.name, u.email, u.phone, u.role,
       u.company_id, c.name AS company_name,
       (SELECT status FROM subscriptions 
         WHERE company_id = u.company_id AND status = 'active' 
         ORDER BY id DESC LIMIT 1) AS subscription_status
     FROM users u
     JOIN companies c ON u.company_id = c.id
     ORDER BY u.created_at DESC`
  );

  res.json({
    success: true,
    data: rows,
  });
}
async function logout(req, res) {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
    };

    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("user", { ...cookieOptions, httpOnly: false });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  createUser,
  signup,
  login,
  getMe,
  getAllUsers,
  updateProfile,
  logout
};