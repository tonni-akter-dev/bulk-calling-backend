const express = require('express');
const router = express.Router();
const db = require('../config/db');
const wallet = require('../services/walletService');

router.post('/voice-status', async (req, res) => {
  try {
    const { call_id, status, duration_seconds, metadata } = req.body;
    const { campaign_number_id, campaign_id } = metadata || {};

    if (!campaign_number_id) {
      return res.status(400).json({ error: 'Missing metadata' });
    }

    if (status === 'completed') {
      await db.query(
        `UPDATE campaign_numbers SET status='completed', duration_seconds=? WHERE id=?`,
        [duration_seconds || 0, campaign_number_id]
      );

      const [[campaign]] = await db.query(`SELECT company_id FROM campaigns WHERE id=?`, [campaign_id]);
      if (campaign) {
        await wallet.debitForCall(campaign.company_id, campaign_number_id, duration_seconds);
      }
    } else if (['failed', 'busy', 'no-answer'].includes(status)) {
      await db.query(`UPDATE campaign_numbers SET status=? WHERE id=?`, [status, campaign_number_id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;