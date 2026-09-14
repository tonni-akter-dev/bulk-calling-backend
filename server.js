const path = require("path");
const dotenv = require("dotenv");
const envPath = path.join(__dirname, ".env");
const { syncRecentCalls } = require('./src/services/ipcallSyncService');
const result = dotenv.config({
  path: envPath,
});

if (result.error) {
  console.log("⚠️ .env file not loaded");
  console.log("ℹ️ Using cPanel environment variables");
} else {
  console.log("✅ .env file loaded successfully");
}

const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/authRoutes");
const subscriptionRoutes = require("./src/routes/subscriptionRoutes");
const campaignRoutes = require("./src/routes/campaignRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const webhookRoutes = require("./src/routes/webhookRoutes");
const contactRoutes = require("./src/routes/contactRoutes");
const ticketRoutes = require("./src/routes/ticketRoutes");
const planRoutes = require("./src/routes/planRoutes");
const voiceFileRoutes = require("./src/routes/voiceFileRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const contactFormRoutes = require("./src/routes/contactFormRoutes");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/voice-files", voiceFileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/contactForm", contactFormRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    environment: process.env.NODE_ENV || "development",
    database: {
      host: process.env.DB_HOST || null,
      database: process.env.DB_NAME || null,
      user: process.env.DB_USER || null,
      passwordLoaded: !!process.env.DB_PASSWORD,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);

  // 🆕 IP Call BD sync — প্রতি ২ মিনিটে
  setInterval(async () => {
    try {
      await syncRecentCalls();
    } catch (err) {
      console.error('[Sync interval] error:', err.message);
    }
  }, 120_000);   // 2 minutes

  // প্রথমবার 10 সেকেন্ড পরে চালাও
  setTimeout(syncRecentCalls, 10_000);

  console.log('✅ IP Call BD sync started (every 2 min)');
});