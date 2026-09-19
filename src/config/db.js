// const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// const mysql = require("mysql2/promise");


// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT || 3306),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,

//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// // Test MySQL connection
// (async () => {
//   try {
//     const connection = await pool.getConnection();
//     console.log("✅ MYSQL CONNECTED SUCCESSFULLY");
//     connection.release();
//   } catch (error) {
//     console.error("❌ MYSQL CONNECTION FAILED");
//     console.error("Code:", error.code);
//     console.error("Message:", error.message);
//   }
// })();

// module.exports = pool;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require("mysql2/promise");

// ============================================================
// Detect if SSL is needed (Railway MySQL requires SSL)
// ============================================================
const useSSL = process.env.DB_SSL === 'true' || 
               (process.env.DB_HOST && process.env.DB_HOST.includes('railway'));

// ============================================================
// MySQL Connection Pool
// ============================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000,          // 30 seconds
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // 👇 SSL config for Railway / remote MySQL
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

// ============================================================
// Test MySQL connection
// ============================================================
(async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 AS ok');
    console.log("✅ MYSQL CONNECTED SUCCESSFULLY");
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Port: ${process.env.DB_PORT}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   SSL: ${useSSL ? 'ENABLED' : 'DISABLED'}`);
    connection.release();
  } catch (error) {
    console.error("❌ MYSQL CONNECTION FAILED");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Host:", process.env.DB_HOST);
    console.error("Port:", process.env.DB_PORT);
    console.error("User:", process.env.DB_USER);
    console.error("Database:", process.env.DB_NAME);
  }
})();

module.exports = pool;