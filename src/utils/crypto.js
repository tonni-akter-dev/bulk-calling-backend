const crypto = require('crypto');

const MASTER_KEY = process.env.MASTER_KEY;

function getKeyBuffer() {
  if (!MASTER_KEY || MASTER_KEY.length !== 64) {
    throw new Error('MASTER_KEY must be 64 hex chars in .env');
  }
  return Buffer.from(MASTER_KEY, 'hex');
}

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKeyBuffer(), iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

function decrypt(payload) {
  if (!payload) return null;
  const [ivHex, dataHex] = String(payload).split(':');
  if (!ivHex || !dataHex) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKeyBuffer(), iv);
  let dec = decipher.update(dataHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function maskSecret(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 4) return '••••';
  return `••••••${s.slice(-4)}`;
}

module.exports = { encrypt, decrypt, maskSecret };