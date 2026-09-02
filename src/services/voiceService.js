const axios = require('axios');

async function placeCall({ toNumber, campaignId, campaignNumberId, audioUrl }) {
  const payload = {
    caller_id: process.env.CALLER_ID,
    to: toNumber,
    audio_url: audioUrl,
    callback_url: `${process.env.BASE_URL}/webhooks/voice-status`,
    metadata: {
      campaign_id: campaignId,
      campaign_number_id: campaignNumberId
    }
  };

  const response = await axios.post(process.env.VOICE_GATEWAY_URL, payload, {
    headers: {
      'Authorization': `Bearer ${process.env.VOICE_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });

  return response.data.call_id || response.data.sid;
}

module.exports = { placeCall };