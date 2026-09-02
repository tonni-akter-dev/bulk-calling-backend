const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'audio');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

// Twilio's <Play> supports mp3 and wav well. Reject everything else early.
const allowed = ['.mp3', '.wav'];
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only .mp3 and .wav audio files are allowed'));
}

const uploadAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Separate in-memory uploader for small CSV number lists (we just parse and discard the file)
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype === 'text/csv') cb(null, true);
    else cb(new Error('Only .csv files are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = { uploadAudio, uploadCsv, uploadDir };
