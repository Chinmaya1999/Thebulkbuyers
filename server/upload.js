// Shared image upload handler (JPG/PNG/WebP, max 5MB) used by the admin and seller consoles.
const multer = require('multer');
const crypto = require('crypto');
const { q } = require('./db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const sniff = b => b.length > 12 && (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'image/jpeg' : b.slice(0, 4).toString('hex') === '89504e47' ? 'image/png' : b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : null);

module.exports = (req, res, next) => upload.single('image')(req, res, async err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 5MB)' : err.message });
  const mime = req.file && sniff(req.file.buffer);
  if (!mime) return res.status(400).json({ error: 'Only JPG, PNG or WebP images' });
  const id = crypto.randomBytes(12).toString('hex');
  try { await q.run('INSERT INTO images(id,mime,data) VALUES(?,?,?)', id, mime, req.file.buffer); } catch (e) { return next(e); }
  res.json({ url: '/uploads/' + id });
});
