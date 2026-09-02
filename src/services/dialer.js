const db = require('../config/db');
const { placeCall } = require('./voiceService');
const wallet = require('./walletService');

let globalActiveCalls = 0;
const runningCampaigns = new Set();

async function startCampaign(campaignId) {
  if (runningCampaigns.has(campaignId)) return;
  runningCampaigns.add(campaignId);

  await db.query(`UPDATE campaigns SET status='running', started_at=NOW() WHERE id=?`, [campaignId]);
  processCampaign(campaignId).catch(async (err) => {
    console.error(`Campaign ${campaignId} failed:`, err);
    await db.query(`UPDATE campaigns SET status='failed' WHERE id=?`, [campaignId]);
    runningCampaigns.delete(campaignId);
  });
}

async function processCampaign(campaignId) {
  const [[campaign]] = await db.query(
    `SELECT c.*, a.public_url AS audio_url
     FROM campaigns c
     JOIN audio_files a ON a.id = c.audio_file_id
     WHERE c.id = ?`,
    [campaignId]
  );

  if (!campaign) {
    await db.query(`UPDATE campaigns SET status='failed' WHERE id=?`, [campaignId]);
    runningCampaigns.delete(campaignId);
    return;
  }

  const maxGlobalConcurrent = parseInt(process.env.MAX_GLOBAL_CONCURRENT_CALLS || '10', 10);
  const retryLimit = parseInt(process.env.CALL_RETRY_LIMIT || '1', 10);

  while (true) {
    const [[current]] = await db.query(`SELECT status FROM campaigns WHERE id=?`, [campaignId]);
    if (!current || current.status !== 'running') break;

    const enoughBalance = await wallet.hasEnoughForOneCall(campaign.company_id);
    if (!enoughBalance) {
      await db.query(
        `UPDATE campaigns SET status='paused', pause_reason='insufficient_balance' WHERE id=?`,
        [campaignId]
      );
      break;
    }

    if (globalActiveCalls >= maxGlobalConcurrent) {
      await sleep(1000);
      continue;
    }

    const [[nextNumber]] = await db.query(
      `SELECT * FROM campaign_numbers
       WHERE campaign_id = ? AND status = 'pending' AND attempts <= ?
       ORDER BY id ASC LIMIT 1`,
      [campaignId, retryLimit]
    );

    if (!nextNumber) {
      await db.query(`UPDATE campaigns SET status='completed', finished_at=NOW() WHERE id=?`, [campaignId]);
      break;
    }

    const [[dnc]] = await db.query(
      `SELECT id FROM do_not_call WHERE company_id=? AND phone_number=?`,
      [campaign.company_id, nextNumber.phone_number]
    );
    if (dnc) {
      await db.query(`UPDATE campaign_numbers SET status='skipped_dnc' WHERE id=?`, [nextNumber.id]);
      continue;
    }

    await db.query(
      `UPDATE campaign_numbers SET status='calling', attempts = attempts + 1 WHERE id=?`,
      [nextNumber.id]
    );

    globalActiveCalls++;

    placeCall({
      toNumber: nextNumber.phone_number,
      campaignId,
      campaignNumberId: nextNumber.id,
      audioUrl: campaign.audio_url
    })
      .then(async (callSid) => {
        await db.query(`UPDATE campaign_numbers SET twilio_call_sid=? WHERE id=?`, [callSid, nextNumber.id]);
      })
      .catch(async (err) => {
        console.error(`Call failed for number ${nextNumber.phone_number}:`, err.message);
        await db.query(`UPDATE campaign_numbers SET status='failed' WHERE id=?`, [nextNumber.id]);
      })
      .finally(() => {
        globalActiveCalls--;
      });

    await sleep(300);
  }

  runningCampaigns.delete(campaignId);
}

function pauseCampaign(campaignId) {
  return db.query(
    `UPDATE campaigns SET status='paused', pause_reason='manual' WHERE id=? AND status='running'`,
    [campaignId]
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { startCampaign, pauseCampaign };