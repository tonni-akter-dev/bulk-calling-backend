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

  const [existing] = await db. query('SELECT id FROM users WHERE email=?', [email]);
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


// controllers/authController.js




// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const db = require('../config/db');

// const { sendMail } = require('../utils/mailer');
// const { sendSms } = require('../utils/sms');
// const { issueCode, consumeCode, assertResendAllowed } = require('../utils/otp');

// /* ------------------------------------------------------------------ */
// /* Helpers                                                             */
// /* ------------------------------------------------------------------ */

// function normalizePhone(raw) {
//   if (!raw) return null;
//   const cleaned = String(raw).replace(/[\s\-().]/g, '');
//   return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : null;
// }

// /* ------------------------------------------------------------------ */
// /* Super Admin creates a new user (company admin)                      */
// /* ------------------------------------------------------------------ */
// async function createUser(req, res) {
//   const { companyName, name, email, phone = null, password, role = 'user' } = req.body;

//   // Only super_admin can create users
//   if (req.user.role !== 'super_admin') {
//     return res.status(403).json({ error: 'Only Super Admin can create users' });
//   }

//   if (!companyName || !name || !email || !password) {
//     return res.status(400).json({ error: 'companyName, name, email, password are required' });
//   }

//   const normalizedPhone = normalizePhone(phone);

//   const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
//   if (existing.length) return res.status(409).json({ error: 'Email already registered' });

//   if (normalizedPhone) {
//     const [phoneExists] = await db.query('SELECT id FROM users WHERE phone=?', [normalizedPhone]);
//     if (phoneExists.length) return res.status(409).json({ error: 'Phone number already registered' });
//   }

//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     // Check if company already exists
//     let [companyRows] = await conn.query(
//       'SELECT id FROM companies WHERE name = ? OR email = ?',
//       [companyName, email]
//     );
//     let companyId;

//     if (companyRows.length) {
//       companyId = companyRows[0].id;
//     } else {
//       const [companyResult] = await conn.query(
//         'INSERT INTO companies (name, email) VALUES (?, ?)',
//         [companyName, email]
//       );
//       companyId = companyResult.insertId;
//     }

//     const passwordHash = await bcrypt.hash(password, 10);
//     const [userResult] = await conn.query(
//       'INSERT INTO users (company_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
//       [companyId, name, email, normalizedPhone, passwordHash, role]
//     );

//     await conn.commit();

//     const userId = userResult.insertId;

//     res.status(201).json({
//       message: 'User created successfully',
//       user: {
//         id: userId,
//         name,
//         email,
//         phone: normalizedPhone,
//         role,
//         companyId,
//         companyName
//       }
//     });
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// }

// /* ------------------------------------------------------------------ */
// /* Regular user signup (self-signup)                                   */
// /* ------------------------------------------------------------------ */
// async function signup(req, res) {
//   const { companyName, name, email, phone = null, password } = req.body;
//   if (!companyName || !name || !email || !password) {
//     return res.status(400).json({ error: 'companyName, name, email, password are required' });
//   }

//   const normalizedPhone = normalizePhone(phone);

//   const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
//   if (existing.length) return res.status(409).json({ error: 'Email already registered' });

//   if (normalizedPhone) {
//     const [phoneExists] = await db.query('SELECT id FROM users WHERE phone=?', [normalizedPhone]);
//     if (phoneExists.length) return res.status(409).json({ error: 'Phone number already registered' });
//   }

//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     const [companyResult] = await conn.query(
//       'INSERT INTO companies (name, email) VALUES (?, ?)',
//       [companyName, email]
//     );
//     const companyId = companyResult.insertId;

//     const passwordHash = await bcrypt.hash(password, 10);
//     const [userResult] = await conn.query(
//       'INSERT INTO users (company_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, "admin")',
//       [companyId, name, email, normalizedPhone, passwordHash]
//     );

//     await conn.commit();

//     const userId = userResult.insertId;
//     const role = 'admin';

//     const token = jwt.sign(
//       { userId, companyId, role, emailVerified: false },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     res.status(201).json({
//       message: 'Signup successful',
//       token,
//       user: {
//         id: userId,
//         name,
//         email,
//         phone: normalizedPhone,
//         role,
//         companyId,
//         companyName,
//         emailVerified: false,
//         phoneVerified: false
//       }
//     });
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// }

// /* ------------------------------------------------------------------ */
// /* Login for all users                                                 */
// /* ------------------------------------------------------------------ */
// async function login(req, res) {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(400).json({ error: 'Email and password are required' });
//   }

//   const [rows] = await db.query(
//     `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.company_id,
//             u.email_verified, u.phone_verified,
//             c.name AS company_name
//        FROM users u
//        JOIN companies c ON u.company_id = c.id
//       WHERE u.email = ?`,
//     [email]
//   );

//   if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

//   const user = rows[0];
//   const valid = await bcrypt.compare(password, user.password_hash);
//   if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

//   const token = jwt.sign(
//     {
//       userId: user.id,
//       companyId: user.company_id,
//       role: user.role,
//       emailVerified: !!user.email_verified
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: '7d' }
//   );

//   res.json({
//     message: 'Login successful',
//     token,
//     user: {
//       id: user.id,
//       name: user.name,
//       email: user.email,
//       phone: user.phone,
//       role: user.role,
//       companyId: user.company_id,
//       companyName: user.company_name,
//       emailVerified: !!user.email_verified,
//       phoneVerified: !!user.phone_verified
//     }
//   });
// }

// /* ------------------------------------------------------------------ */
// /* Get current user                                                    */
// /* ------------------------------------------------------------------ */
// async function getMe(req, res) {
//   const [rows] = await db.query(
//     `SELECT u.id, u.name, u.email, u.phone, u.role, u.company_id,
//             u.email_verified, u.phone_verified,
//             c.name AS company_name
//        FROM users u
//        JOIN companies c ON u.company_id = c.id
//       WHERE u.id = ?`,
//     [req.user.userId]
//   );

//   if (!rows.length) return res.status(404).json({ error: 'User not found' });

//   const row = rows[0];
//   res.json({
//     id: row.id,
//     name: row.name,
//     email: row.email,
//     phone: row.phone,
//     role: row.role,
//     companyId: row.company_id,
//     companyName: row.company_name,
//     emailVerified: !!row.email_verified,
//     phoneVerified: !!row.phone_verified
//   });
// }

// /* ------------------------------------------------------------------ */
// /* Get all users (Super Admin only)                                    */
// /* ------------------------------------------------------------------ */
// async function getAllUsers(req, res) {
//   if (req.user.role !== 'super_admin') {
//     return res.status(403).json({ error: 'Only Super Admin can view all users' });
//   }

//   const [rows] = await db.query(
//     `SELECT u.id, u.name, u.email, u.phone, u.role, u.company_id,
//             u.email_verified, u.phone_verified,
//             c.name AS company_name,
//             (SELECT status FROM subscriptions
//               WHERE company_id = u.company_id AND status = 'active'
//               ORDER BY id DESC LIMIT 1) AS subscription_status
//        FROM users u
//        JOIN companies c ON u.company_id = c.id
//       ORDER BY u.created_at DESC`
//   );

//   res.json(rows.map(r => ({
//     id: r.id,
//     name: r.name,
//     email: r.email,
//     phone: r.phone,
//     role: r.role,
//     companyId: r.company_id,
//     companyName: r.company_name,
//     emailVerified: !!r.email_verified,
//     phoneVerified: !!r.phone_verified,
//     subscriptionStatus: r.subscription_status
//   })));
// }

// /* ------------------------------------------------------------------ */
// /* EMAIL VERIFICATION                                                  */
// /* ------------------------------------------------------------------ */

// // POST /api/auth/verify/email/send   (protected)
// async function sendEmailVerificationCode(req, res) {
//   const [rows] = await db.query(
//     'SELECT id, name, email, email_verified FROM users WHERE id = ?',
//     [req.user.userId]
//   );
//   if (!rows.length) return res.status(404).json({ error: 'User not found' });

//   const user = rows[0];
//   if (user.email_verified) {
//     return res.status(400).json({ error: 'Email is already verified' });
//   }

//   await assertResendAllowed(user.email, 'email_verify');

//   const { code, expiresInMinutes } = await issueCode({
//     userId: user.id,
//     identifier: user.email,
//     channel: 'email',
//     purpose: 'email_verify'
//   });

//   await sendMail({
//     to: user.email,
//     subject: 'Verify your email address',
//     text: `Hi ${user.name},\n\nYour verification code is ${code}.\nIt expires in ${expiresInMinutes} minutes.\n\nIf you didn't request this, ignore this email.`,
//     html: `<p>Hi ${user.name},</p>
//            <p>Your verification code is:</p>
//            <h2 style="letter-spacing:4px">${code}</h2>
//            <p>It expires in ${expiresInMinutes} minutes.</p>`
//   });

//   res.json({ message: 'Verification code sent to your email', expiresInMinutes });
// }

// // POST /api/auth/verify/email/confirm   (protected)  { code }
// async function confirmEmailVerification(req, res) {
//   const { code } = req.body;
//   if (!code) return res.status(400).json({ error: 'code is required' });

//   const [rows] = await db.query(
//     'SELECT id, email, email_verified FROM users WHERE id = ?',
//     [req.user.userId]
//   );
//   if (!rows.length) return res.status(404).json({ error: 'User not found' });

//   const user = rows[0];
//   if (user.email_verified) {
//     return res.status(400).json({ error: 'Email is already verified' });
//   }

//   const result = await consumeCode({
//     identifier: user.email,
//     purpose: 'email_verify',
//     code
//   });
//   if (!result.ok) return res.status(400).json({ error: result.error });

//   await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);

//   res.json({ message: 'Email verified successfully' });
// }

// /* ------------------------------------------------------------------ */
// /* PHONE VERIFICATION                                                  */
// /* ------------------------------------------------------------------ */

// // POST /api/auth/verify/phone/send   (protected)  { phone? }
// async function sendPhoneVerificationCode(req, res) {
//   const [rows] = await db.query(
//     'SELECT id, name, phone, phone_verified FROM users WHERE id = ?',
//     [req.user.userId]
//   );
//   if (!rows.length) return res.status(404).json({ error: 'User not found' });

//   const user = rows[0];
//   const targetPhone = normalizePhone(req.body.phone || user.phone);
//   if (!targetPhone) {
//     return res.status(400).json({ error: 'A valid phone number is required' });
//   }

//   if (targetPhone !== user.phone) {
//     const [dup] = await db.query(
//       'SELECT id FROM users WHERE phone = ? AND id <> ?',
//       [targetPhone, user.id]
//     );
//     if (dup.length) return res.status(409).json({ error: 'Phone number already in use' });

//     await db.query('UPDATE users SET phone = ?, phone_verified = 0 WHERE id = ?', [
//       targetPhone,
//       user.id
//     ]);
//   } else if (user.phone_verified) {
//     return res.status(400).json({ error: 'Phone is already verified' });
//   }

//   await assertResendAllowed(targetPhone, 'phone_verify');

//   const { code, expiresInMinutes } = await issueCode({
//     userId: user.id,
//     identifier: targetPhone,
//     channel: 'sms',
//     purpose: 'phone_verify'
//   });

//   await sendSms({
//     to: targetPhone,
//     message: `Your verification code is ${code}. It expires in ${expiresInMinutes} minutes.`
//   });

//   res.json({
//     message: 'Verification code sent to your phone',
//     phone: targetPhone,
//     expiresInMinutes
//   });
// }

// // POST /api/auth/verify/phone/confirm   (protected)  { code }
// async function confirmPhoneVerification(req, res) {
//   const { code } = req.body;
//   if (!code) return res.status(400).json({ error: 'code is required' });

//   const [rows] = await db.query(
//     'SELECT id, phone, phone_verified FROM users WHERE id = ?',
//     [req.user.userId]
//   );
//   if (!rows.length) return res.status(404).json({ error: 'User not found' });

//   const user = rows[0];
//   if (!user.phone) return res.status(400).json({ error: 'No phone number on file' });
//   if (user.phone_verified) {
//     return res.status(400).json({ error: 'Phone is already verified' });
//   }

//   const result = await consumeCode({
//     identifier: user.phone,
//     purpose: 'phone_verify',
//     code
//   });
//   if (!result.ok) return res.status(400).json({ error: result.error });

//   await db.query('UPDATE users SET phone_verified = 1 WHERE id = ?', [user.id]);

//   res.json({ message: 'Phone verified successfully' });
// }

// /* ------------------------------------------------------------------ */
// /* FORGOT / RESET PASSWORD                                             */
// /* ------------------------------------------------------------------ */

// // POST /api/auth/forgot-password   (public)  { email }
// async function forgotPassword(req, res) {
//   const { email } = req.body;
//   if (!email) return res.status(400).json({ error: 'Email is required' });

//   // Never reveal whether the account exists
//   const genericMessage =
//     'If an account exists for that email, a reset code has been sent.';

//   const [rows] = await db.query(
//     'SELECT id, name, email FROM users WHERE email = ?',
//     [email]
//   );

//   if (rows.length) {
//     const user = rows[0];
//     try {
//       await assertResendAllowed(user.email, 'password_reset');

//       const { code, expiresInMinutes } = await issueCode({
//         userId: user.id,
//         identifier: user.email,
//         channel: 'email',
//         purpose: 'password_reset'
//       });

//       await sendMail({
//         to: user.email,
//         subject: 'Password reset code',
//         text: `Hi ${user.name},\n\nYour password reset code is ${code}.\nIt expires in ${expiresInMinutes} minutes.\n\nIf you didn't request this, ignore this email.`,
//         html: `<p>Hi ${user.name},</p>
//                <p>Your password reset code is:</p>
//                <h2 style="letter-spacing:4px">${code}</h2>
//                <p>It expires in ${expiresInMinutes} minutes.</p>`
//       });
//     } catch (err) {
//       if (err.status === 429) return res.status(429).json({ error: err.message });
//       throw err;
//     }
//   }

//   res.json({ message: genericMessage });
// }

// // POST /api/auth/verify-reset-code   (public)  { email, code }
// // Exchanges a valid OTP for a short-lived reset token.
// async function verifyResetCode(req, res) {
//   const { email, code } = req.body;
//   if (!email || !code) {
//     return res.status(400).json({ error: 'Email and code are required' });
//   }

//   const [rows] = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);
//   if (!rows.length) {
//     return res.status(400).json({ error: 'Invalid or expired code' });
//   }

//   const user = rows[0];
//   const result = await consumeCode({
//     identifier: user.email,
//     purpose: 'password_reset',
//     code
//   });
//   if (!result.ok) return res.status(400).json({ error: result.error });

//   const resetToken = jwt.sign(
//     { userId: user.id, purpose: 'password_reset' },
//     process.env.JWT_SECRET,
//     { expiresIn: '15m' }
//   );

//   res.json({ message: 'Code verified', resetToken });
// }

// // POST /api/auth/reset-password   (public)  { resetToken, newPassword }
// async function resetPassword(req, res) {
//   const { resetToken, newPassword } = req.body;
//   if (!resetToken || !newPassword) {
//     return res.status(400).json({ error: 'resetToken and newPassword are required' });
//   }
//   if (newPassword.length < 8) {
//     return res.status(400).json({ error: 'Password must be at least 8 characters' });
//   }

//   let payload;
//   try {
//     payload = jwt.verify(resetToken, process.env.JWT_SECRET);
//   } catch (err) {
//     return res.status(401).json({ error: 'Invalid or expired reset token' });
//   }
//   if (payload.purpose !== 'password_reset') {
//     return res.status(401).json({ error: 'Invalid reset token' });
//   }

//   const passwordHash = await bcrypt.hash(newPassword, 10);
//   const [result] = await db.query(
//     'UPDATE users SET password_hash = ? WHERE id = ?',
//     [passwordHash, payload.userId]
//   );
//   if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });

//   res.json({ message: 'Password reset successful. Please log in with your new password.' });
// }

// /* ------------------------------------------------------------------ */
// /* Exports                                                             */
// /* ------------------------------------------------------------------ */
// module.exports = {
//   // core
//   createUser,
//   signup,
//   login,
//   getMe,
//   getAllUsers,
//   // verification
//   sendEmailVerificationCode,
//   confirmEmailVerification,
//   sendPhoneVerificationCode,
//   confirmPhoneVerification,
//   // password reset
//   forgotPassword,
//   verifyResetCode,
//   resetPassword
// };