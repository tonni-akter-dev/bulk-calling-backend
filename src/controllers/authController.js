const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Super Admin creates a new user (company admin)
async function createUser(req, res) {
  const { companyName, name, email, password, role = 'user' } = req.body;
  
  // Only super_admin can create users
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can create users' });
  }

  if (!companyName || !name || !email || !password) {
    return res.status(400).json({ error: 'companyName, name, email, password are required' });
  }

  const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check if company already exists
    let [companyRows] = await conn.query('SELECT id FROM companies WHERE name = ? OR email = ?', [companyName, email]);
    let companyId;
    
    if (companyRows.length) {
      companyId = companyRows[0].id;
    } else {
      const [companyResult] = await conn.query('INSERT INTO companies (name, email) VALUES (?, ?)', [companyName, email]);
      companyId = companyResult.insertId;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [companyId, name, email, passwordHash, role]
    );

    await conn.commit();

    const userId = userResult.insertId;

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userId,
        name,
        email,
        role,
        companyId,
        companyName
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Regular user signup (for Super Admin creation)
async function signup(req, res) {
  const { companyName, name, email, password } = req.body;
  if (!companyName || !name || !email || !password) {
    return res.status(400).json({ error: 'companyName, name, email, password are required' });
  }

  const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [companyResult] = await conn.query('INSERT INTO companies (name, email) VALUES (?, ?)', [companyName, email]);
    const companyId = companyResult.insertId;

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, "admin")',
      [companyId, name, email, passwordHash]
    );

    await conn.commit();

    const userId = userResult.insertId;
    const role = 'user';

    const token = jwt.sign(
      { userId, companyId, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Signup successful',
      token,
      user: {
        id: userId,
        name,
        email,
        role,
        companyId,
        companyName
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Login for all users
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.company_id, c.name AS company_name  
     FROM users u  
     JOIN companies c ON u.company_id = c.id  
     WHERE u.email = ?`,
    [email]
  );

  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user.id, companyId: user.company_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name
    }
  });
}

// Get current user
async function getMe(req, res) {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.company_id, c.name AS company_name  
     FROM users u  
     JOIN companies c ON u.company_id = c.id  
     WHERE u.id = ?`,
    [req.user.userId]
  );
  
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  
  res.json(rows[0]);
}

// Get all users (Super Admin only)
async function getAllUsers(req, res) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can view all users' });
  }
  
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.company_id, c.name AS company_name,
     (SELECT status FROM subscriptions WHERE company_id = u.company_id AND status = 'active' ORDER BY id DESC LIMIT 1) AS subscription_status
     FROM users u  
     JOIN companies c ON u.company_id = c.id  
     ORDER BY u.created_at DESC`
  );
  
  res.json(rows);
}

module.exports = { 
  createUser,
  signup, 
  login,
  getMe,
  getAllUsers
};