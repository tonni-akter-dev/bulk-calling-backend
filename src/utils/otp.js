const crypto = require("crypto");
const db = require("../config/db");

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || 60,
);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_SECRET = process.env.OTP_SECRET || process.env.JWT_SECRET;

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString(); // 6 digits
}

function hashCode(code) {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(String(code))
    .digest("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a || "", "utf8");
  const bufB = Buffer.from(b || "", "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Throws a 429 error if a code was issued for this identifier too recently. */
async function assertResendAllowed(identifier, purpose) {
  const [rows] = await db.query(
    `SELECT created_at FROM verification_codes
      WHERE identifier = ? AND purpose = ?
      ORDER BY id DESC LIMIT 1`,
    [identifier, purpose],
  );
  if (!rows.length) return;

  const elapsed = (Date.now() - new Date(rows[0].created_at).getTime()) / 1000;
  if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
    const err = new Error(
      `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting another code`,
    );
    err.status = 429;
    throw err;
  }
}

/** Invalidates previous codes and stores a new hashed one. Returns the plain code. */
async function issueCode({
  userId = null,
  identifier,
  channel,
  purpose,
  ttlMinutes = OTP_TTL_MINUTES,
}) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await db.query(
    `UPDATE verification_codes SET consumed_at = NOW()
      WHERE identifier = ? AND purpose = ? AND consumed_at IS NULL`,
    [identifier, purpose],
  );

  await db.query(
    `INSERT INTO verification_codes (user_id, identifier, channel, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, identifier, channel, purpose, hashCode(code), expiresAt],
  );

  return { code, expiresInMinutes: ttlMinutes };
}

/** Verifies + burns a code. Returns { ok, error?, record? }. */
async function consumeCode({ identifier, purpose, code }) {
  const [rows] = await db.query(
    `SELECT * FROM verification_codes
      WHERE identifier = ? AND purpose = ? AND consumed_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [identifier, purpose],
  );

  if (!rows.length)
    return {
      ok: false,
      error: "No active code found. Please request a new one.",
    };

  const rec = rows[0];

  if (new Date(rec.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Code has expired. Please request a new one." };
  }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many invalid attempts. Please request a new code.",
    };
  }
  if (!safeEqual(rec.code_hash, hashCode(code))) {
    await db.query(
      "UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?",
      [rec.id],
    );
    return { ok: false, error: "Invalid code." };
  }

  await db.query(
    "UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?",
    [rec.id],
  );
  return { ok: true, record: rec };
}

module.exports = {
  generateCode,
  hashCode,
  issueCode,
  consumeCode,
  assertResendAllowed,
  OTP_TTL_MINUTES,
};
