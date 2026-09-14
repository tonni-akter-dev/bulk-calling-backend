// utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for others
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
});

async function sendMail({ to, subject, text, html }) {
  if (process.env.MAIL_DISABLED === 'true') {
    console.log(`\n[mailer:disabled] to=${to}\nsubject=${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to, subject, text, html
  });
}

module.exports = { sendMail };