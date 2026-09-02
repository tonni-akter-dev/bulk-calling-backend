const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

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
    const role = 'admin';

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

module.exports = { signup, login };