const callLogService = require('../services/callLogService');

async function getCallLogs(req, res) {
  const result = await callLogService.getCallLogs(req.user.companyId, req.query);
  res.json({ success: true, ...result });
}

async function exportCallLogs(req, res) {
  const data = await callLogService.exportCallLogs(req.user.companyId, req.query);
  
  // Dynamic CSV download response
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="call_logs.csv"');

  let csvContent = "SN,Call Type,From/To,IP Number,Agent,Duration,Started At,Status\n";
  data.forEach((row) => {
    csvContent += `"${row.sn}","${row.callType}","${row.fromTo}","${row.ipNumber}","${row.agent}","${row.duration}","${row.startedAt}","${row.status}"\n`;
  });

  res.status(200).send(csvContent);
}

module.exports = { getCallLogs, exportCallLogs };