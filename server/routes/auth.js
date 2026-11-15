const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q } = require('../db');
const { sign, setCookie, COOKIE, requireAuth, notifyAdmins } = require('../auth');
const { str, isEmail, GSTIN_RE } = require('../util');

const strongEnough = p => typeof p === 'string' && p.length >= 8 && p.length <= 100 && /[a-zA-Z]/.test(p) && /\d/.test(p);
const code = () => 'TBB' + crypto.randomBytes(3).toString('hex').toUpperCase();
const DUMMY = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali';

router.post('/register', async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), role = 'buyer'; // admin creates every other account type
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!strongEnough(b.password)) return res.status(400).json({ error: 'Password needs 8+ characters with letters and numbers' });
  if (await q.get('SELECT id FROM users WHERE lower(email)=?', email)) return res.status(409).json({ error: 'An account with this email already exists' });

  let ref = null;
  if (b.ref) { const r = await q.get('SELECT id FROM users WHERE referral_code=? AND role=?', str(b.ref, 20).toUpperCase(), 'agent'); if (r) ref = r.id; }
  const status = 'active';
  const id = await q.insert(`INSERT INTO users(name,email,phone,company,country,gst,password_hash,role,status,referral_code,referred_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, name, email, str(b.phone, 30), str(b.company, 120), str(b.country, 60) || 'India', str(b.gst, 30),
    bcrypt.hashSync(b.password, 10), role, status, code(), ref);
  await notifyAdmins(`New buyer registered: ${name} (${str(b.company, 120) || 'no company'})`, '#users');
  setCookie(res, sign({ id, role }));
  res.status(201).json({ ok: true, role });
});

router.post('/login', async (req, res) => {
  const email = str(req.body?.email, 120).toLowerCase(), password = req.body?.password;
  const u = await q.get('SELECT * FROM users WHERE lower(email)=?', email);
  const ok = bcrypt.compareSync(String(password || ''), u ? u.password_hash : DUMMY);
  if (!u || !ok) return res.status(401).json({ error: 'Incorrect email or password' });
  if (u && !['admin', 'buyer'].includes(u.role)) return res.status(403).json({ error: 'This account type is managed by the admin team.' });
  if (u.status === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact support.' });
  await q.run('UPDATE users SET last_login=now() WHERE id=?', u.id);
  setCookie(res, sign(u));
  res.json({ ok: true, role: u.role });
});

router.post('/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

// Returns { user: null } (200) when signed out so the SPA avoids noisy 401s.
router.get('/me', async (req, res) => {
  const { optionalAuth } = require('../auth');
  optionalAuth(req, res, () => res.json({ user: req.user }));
});

router.put('/me', requireAuth, async (req, res) => {
  const b = req.body || {}, name = str(b.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Name is required' });
  const gst = str(b.gst, 20).toUpperCase();
  if (gst && !GSTIN_RE.test(gst)) return res.status(400).json({ error: 'GSTIN looks invalid — it should be 15 characters, e.g. 29ABCDE1234F1Z5' });
  await q.run('UPDATE users SET name=?,phone=?,company=?,country=?,gst=?,gst_legal_name=? WHERE id=?', name, str(b.phone, 30), str(b.company, 120), str(b.country, 60), gst, str(b.gst_legal_name, 120), req.user.id);
  res.json({ ok: true });
});

router.put('/password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  const u = await q.get('SELECT password_hash FROM users WHERE id=?', req.user.id);
  if (!bcrypt.compareSync(String(current || ''), u.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!strongEnough(next)) return res.status(400).json({ error: 'New password needs 8+ characters with letters and numbers' });
  await q.run('UPDATE users SET password_hash=? WHERE id=?', bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
