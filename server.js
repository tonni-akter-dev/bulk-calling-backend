// ============================================================
// IMPORTS — MUST come first
// ============================================================
const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");

// ============================================================
// Load env
// ============================================================
const envPath = path.join(__dirname, ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.log("⚠️ .env file not loaded");
  console.log("ℹ️ Using cPanel environment variables");
} else {
  console.log("✅ .env file loaded successfully");
}

// ============================================================
// Routes
// ============================================================
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
const settingsRoutes = require("./src/routes/settingsRoutes");

const app = express();

// ============================================================
// 🚨 CRITICAL: BODY PARSERS MUST BE FIRST
// ============================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.text({ type: ["text/*", "application/*"], limit: "10mb" }));

// ============================================================
// CORS Configuration
// ============================================================
const ALLOWED_ORIGINS = [
  "https://aicallbd.com",
  "https://www.aicallbd.com",
  "https://api.aicallbd.com",
  "https://ai-calling-frontend-six.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    if (origin.endsWith(".aicallbd.com") || origin === "https://aicallbd.com") {
      return callback(null, true);
    }

    if (origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    if (origin.endsWith(".railway.app")) {
      return callback(null, true);
    }

    console.warn("❌ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// ============================================================
// LOGGER — Only for important requests (no live-logs spam)
// ============================================================
app.use((req, res, next) => {
  if (
    req.path.includes("/webhooks/") ||
    req.path.includes("/voice-status")
  ) {
    console.log("====================================");
    console.log("[REQUEST]", req.method, req.originalUrl);
    console.log("QUERY:", JSON.stringify(req.query));
    console.log("BODY:", JSON.stringify(req.body));
    console.log("====================================");
  }
  next();
});

// ============================================================
// Static uploads
// ============================================================
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ============================================================
// ROUTES
// ============================================================
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
app.use("/api/admin/settings", settingsRoutes);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    environment: process.env.NODE_ENV || "development",
    baseUrl: process.env.BASE_URL || null,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS policy violation",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ============================================================
// SERVER START
// ============================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ CORS allowed origins:`, ALLOWED_ORIGINS.join(", "));
  console.log(`✅ BASE_URL:`, process.env.BASE_URL || "(not set!)");
  console.log(`✅ IP Call BD auto-sync scheduled (every 2 min)`);
});

// ============================================================
// IPCall Auto-Sync — Webhook Fallback
// Runs every 2 minutes to pull call status from IPCall
// ============================================================
const ipcallSync = require("./src/services/ipcallSyncService");

// Initial sync 30s after server start
setTimeout(async () => {
  try {
    console.log("[AutoSync] Initial sync starting...");
    const result = await ipcallSync.syncRecentCalls();
    console.log("[AutoSync] Initial result:", result);
  } catch (err) {
    console.error("[AutoSync initial] error:", err.message);
  }
}, 30 * 1000);

// Then every 2 minutes
setInterval(async () => {
  try {
    const result = await ipcallSync.syncRecentCalls();
    if (result?.updated > 0) {
      console.log(`[AutoSync] ✅ Updated ${result.updated} calls`);
    }
  } catch (err) {
    console.error("[AutoSync] error:", err.message);
  }
}, 2 * 60 * 1000);

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});