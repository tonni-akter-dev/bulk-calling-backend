require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const walletRoutes = require('./routes/walletRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const contactRoutes = require('./routes/contactRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const planRoutes = require('./routes/planRoutes');
const voiceFileRoutes = require('./routes/voiceFileRoutes');

const app = express();

/* =========================
   CORS
========================= */

app.use(
  cors({
    origin: true, // Allow requests from all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
    ],
  })
);

// Handle preflight requests
app.options('*', cors());

/* =========================
   BODY PARSERS
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES
========================= */

// Uploaded audio / ticket attachments
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'))
);

/* =========================
   API ROUTES
========================= */

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/wallet', walletRoutes);

app.use('/api/webhooks', webhookRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/voice-files', voiceFileRoutes);

/* =========================
   HEALTH CHECK
========================= */

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
  });
});

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

/* =========================
   CENTRALIZED ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Bulk calling system listening on port ${PORT}`);
});