const path = require("path");
const dotenv = require("dotenv");
const envPath = path.join(__dirname, ".env");
const { syncRecentCalls } = require('./src/services/ipcallSyncService');

const result = dotenv.config({ path: envPath });

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
const settingsRoutes = require("./src/routes/settingsRoutes");

const app = express();

// ============================================================
// 🆕 CORS Configuration — Explicit whitelist
// ============================================================
const ALLOWED_ORIGINS = [
  "https://aicallbd.com",
  "https://www.aicallbd.com",
  "https://ai-calling-frontend-six.vercel.app",  // Vercel preview
  "http://localhost:3000",                        // Local dev
  "http://localhost:3001",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow whitelisted origins
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Allow any *.vercel.app preview deployment
    if (origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    // Reject others
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
  maxAge: 86400, // 24 hours preflight cache
};

// ⚠️ Apply CORS before all routes
app.use(cors(corsOptions));

// ⚠️ Handle preflight for all routes (Express 5+ compatible)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// ============================================================
// Body parsers
// ============================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ============================================================
// Routes
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
// Health check
// ============================================================
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

// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ============================================================
// Error Handler
// ============================================================
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.message);

  // CORS error
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
// Server start
// ============================================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ CORS allowed origins:`, ALLOWED_ORIGINS.join(", "));

  // IP Call BD sync — every 2 min
  setInterval(async () => {
    try {
      await syncRecentCalls();
    } catch (err) {
      console.error("[Sync interval] error:", err.message);
    }
  }, 120_000);

  // First run after 10s
  setTimeout(syncRecentCalls, 10_000);

  console.log("✅ IP Call BD sync started (every 2 min)");
});