const db = require("../config/db");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false, // Must be false for port 25
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendAdminNotification(data) {
  const { fullName, email, phone, subject, message } = data;

  const mailOptions = {
    from: `"${fullName}" <${process.env.SMTP_USER}>`,
    replyTo: email, // Allows the admin to hit "Reply" and email the customer directly
    to: process.env.SUPER_ADMIN_EMAIL,
    subject: `New Contact Form: ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #1d4ed8; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
          New Contact Form Submission
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; width: 120px;">
              <strong>Full Name:</strong>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              ${fullName}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              <strong>Email:</strong>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              <a href="mailto:${email}" style="color: #1d4ed8;">${email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              <strong>Phone:</strong>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              ${phone || 'Not provided'}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              <strong>Subject:</strong>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              ${subject}
            </td>
          </tr>
        </table>

        <div style="margin-top: 25px; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h4 style="margin-top: 0; color: #475569;">Message:</h4>
          <p style="white-space: pre-wrap; line-height: 1.6; color: #334155; margin-bottom: 0;">
            ${message}
          </p>
        </div>
        
        <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
          This email was sent from the contact form on your website.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

async function submitContactForm({ fullName, email, phone, subject, message }) {
  // 1. Validate required fields
  if (!fullName || !email || !subject || !message) {
    throw new Error("Please fill in all required fields.");
  }

  // 2. Save to Database
  const [result] = await db.query(
    `INSERT INTO contact_messages (full_name, email, phone, subject, message, status)
     VALUES (?, ?, ?, ?, ?, 'Unread')`,
    [fullName, email, phone || null, subject, message]
  );

  // 3. Send Email to Super Admin
  try {
    await sendAdminNotification({ fullName, email, phone, subject, message });
  } catch (emailError) {
    console.error("Failed to send email notification:", emailError);
    // We don't throw an error to the frontend because the DB insert succeeded.
    // The message is saved in the database, so the admin can still see it.
  }

  return { 
    id: result.insertId, 
    fullName, 
    email, 
    subject, 
    status: "Unread" 
  };
}

async function listContactMessages({ search, status }) {
  let query = `
    SELECT id, full_name AS fullName, email, phone, subject, message, status, created_at AS dateAdded 
    FROM contact_messages 
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (full_name LIKE ? OR email LIKE ? OR subject LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  if (status && status !== "All") {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY id DESC`;

  const [messages] = await db.query(query, params);
  return messages;
}

async function updateMessageStatus(messageId, status) {
  const [result] = await db.query(
    `UPDATE contact_messages SET status = ? WHERE id = ?`,
    [status, messageId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error("Message not found");
  }
  
  return true;
}

module.exports = {
  submitContactForm,
  listContactMessages,
  updateMessageStatus,
};