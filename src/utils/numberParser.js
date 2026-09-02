const { parse } = require('csv-parse/sync');

// Accepts either a raw textarea blob (one number per line / comma separated)
// or CSV file content, and returns a deduped, cleaned array of E.164-ish numbers.
function parseNumbersFromText(text) {
  const raw = text
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  return dedupeAndClean(raw);
}

function parseNumbersFromCsv(csvBuffer) {
  const records = parse(csvBuffer, { columns: false, skip_empty_lines: true });
  const raw = records.map((row) => row[0]).filter(Boolean);
  return dedupeAndClean(raw);
}

function dedupeAndClean(numbers) {
  const cleaned = numbers
    .map((n) => n.replace(/[^\d+]/g, ''))
    .filter((n) => n.length >= 8); // basic sanity check, not full validation
  return [...new Set(cleaned)];
}

module.exports = { parseNumbersFromText, parseNumbersFromCsv };
