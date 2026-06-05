const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const storage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads', folder);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const imageFilter = (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files allowed'), false);
};

const videoFilter = (req, file, cb) => {
  if (/video\/(mp4|mpeg|quicktime|webm)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only video files allowed'), false);
};

const resourceFilter = (req, file, cb) => {
  const allowed = /pdf|msword|vnd\.openxmlformats|zip|plain/.test(file.mimetype);
  if (allowed) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};

exports.uploadImage = multer({ storage: storage('images'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
exports.uploadVideo = multer({ storage: storage('videos'), fileFilter: videoFilter, limits: { fileSize: 500 * 1024 * 1024 } });
exports.uploadResource = multer({ storage: storage('resources'), fileFilter: resourceFilter, limits: { fileSize: 50 * 1024 * 1024 } });
