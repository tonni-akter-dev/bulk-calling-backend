const db = require('../config/db');
const { buildTwiml } = require('../services/twilioService');
const wallet = require('../services/walletService');

// Twilio requests this when the call connects, to know what to play
function voiceTwiml(req, res) {
  const audioUrl = req.query.audioUrl;
  const campaignNumberId = req.query.campaignNumberId || '';
  const optOutUrl = `${process.env.BASE_URL}/webhooks/voice/optout?campaignNumberId=${campaignNumberId}`;
  const twiml = buildTwiml({ audioUrl, optOutUrl });
  res.type('text/xml').send(twiml);
}

// Fires when the callee presses a DTMF digit during <Gather> (we only wired up 9 = opt out)
async function voiceOptOut(req, res) {
  const digit = req.body.Digits;
  const campaignNumberId = req.query.campaignNumberId;

  if (digit === '9' && campaignNumberId) {
    const [[cn]] = await db.query(
      `SELECT cn.phone_number, c.company_id FROM campaign_numbers cn
       JOIN campaigns c ON c.id = cn.campaign_id WHERE cn.id=?`,
      [campaignNumberId]
    );
    if (cn) {
      await db.query(
        `INSERT IGNORE INTO do_not_call (company_id, phone_number, reason) VALUES (?, ?, 'caller opted out via DTMF')`,
        [cn.company_id, cn.phone_number]
      );
      await db.query(`UPDATE campaign_numbers SET status='opted_out' WHERE id=?`, [campaignNumberId]);
    }
  }

  const VoiceResponse = require('twilio').twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  twiml.say('You have been removed from this list. Goodbye.');
  twiml.hangup();
  res.type('text/xml').send(twiml.toString());
}

// Call status updates: ringing, answered, completed, etc.
async function voiceStatus(req, res) {
  const { campaignNumberId, campaignId } = req.query;
  const { CallStatus, CallDuration } = req.body;

  const statusMap = {
    completed: 'answered', // refined further by AMD callback if it was actually a machine
    busy: 'no_answer',
    'no-answer': 'no_answer',
    failed: 'failed',
    canceled: 'failed'
  };

  if (statusMap[CallStatus]) {
    await db.query(
      `UPDATE campaign_numbers SET status=?, call_duration_seconds=? WHERE id=?`,
      [statusMap[CallStatus], CallDuration || null, campaignNumberId]
    );
  }

  if (CallStatus === 'completed') {
    await db.query(`UPDATE campaigns SET calls_completed = calls_completed + 1 WHERE id=?`, [campaignId]);

    // Only charge if the call actually connected (had some duration) - busy/no-answer/failed cost nothing
    const seconds = Number(CallDuration || 0);
    if (seconds > 0) {
      const [[cn]] = await db.query(`SELECT campaign_id FROM campaign_numbers WHERE id=?`, [campaignNumberId]);
      if (cn) {
        const [[camp]] = await db.query(`SELECT company_id FROM campaigns WHERE id=?`, [cn.campaign_id]);
        if (camp) {
          await wallet.debitForCall(camp.company_id, campaignNumberId, seconds);
        }
      }
    }
  }

  res.sendStatus(200);
}

// Answering Machine Detection result (async, arrives separately from call status)
async function voiceAmd(req, res) {
  const { campaignNumberId } = req.query;
  const { AnsweredBy } = req.body; // 'human', 'machine_start', 'machine_end_beep', etc.

  if (AnsweredBy && AnsweredBy.startsWith('machine')) {
    await db.query(`UPDATE campaign_numbers SET status='voicemail' WHERE id=?`, [campaignNumberId]);
  } else if (AnsweredBy === 'human') {
    await db.query(`UPDATE campaign_numbers SET status='answered' WHERE id=?`, [campaignNumberId]);
  }

  res.sendStatus(200);
}

module.exports = { voiceTwiml, voiceOptOut, voiceStatus, voiceAmd };
