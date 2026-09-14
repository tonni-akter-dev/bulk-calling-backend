const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require("mysql2/promise");


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test MySQL connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MYSQL CONNECTED SUCCESSFULLY");
    connection.release();
  } catch (error) {
    console.error("❌ MYSQL CONNECTION FAILED");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
  }
})();

module.exports = pool;