const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q } = require('../db');
const { sign, setCookie, COOKIE, requireAuth, notifyAdmins } = require('../auth');
const { str, isEmail } = require('../util');

const strongEnough = p => typeof p === 'string' && p.length >= 8 && p.length <= 100 && /[a-zA-Z]/.test(p) && /\d/.test(p);
const code = () => 'TBB' + crypto.randomBytes(3).toString('hex').toUpperCase();

router.post('/register', (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), role = b.role;
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!strongEnough(b.password)) return res.status(400).json({ error: 'Password needs 8+ characters with letters and numbers' });
  if (!['buyer', 'seller', 'agent'].includes(role)) return res.status(400).json({ error: 'Choose a valid account type' });
  if (q.get('SELECT id FROM users WHERE email=?', email)) return res.status(409).json({ error: 'An account with this email already exists' });

  let ref = null;
  if (b.ref) { const r = q.get('SELECT id FROM users WHERE referral_code=? AND role=?', str(b.ref, 20).toUpperCase(), 'agent'); if (r) ref = r.id; }
  const status = role === 'seller' ? 'pending' : 'active'; // sellers are verified by admin
  const r = q.run(`INSERT INTO users(name,email,phone,company,country,gst,password_hash,role,status,referral_code,referred_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, name, email, str(b.phone, 30), str(b.company, 120), str(b.country, 60) || 'India', str(b.gst, 30),
    bcrypt.hashSync(b.password, 10), role, status, code(), ref);
  const user = q.get('SELECT id,role FROM users WHERE id=?', Number(r.lastInsertRowid));
  if (role === 'seller') notifyAdmins(`New seller awaiting verification: ${name} (${str(b.company, 120) || 'no company'})`, '#users');
  setCookie(res, sign(user));
  res.status(201).json({ ok: true, role });
});

router.post('/login', (req, res) => {
  const email = str(req.body?.email, 120).toLowerCase(), password = req.body?.password;
  const u = q.get('SELECT * FROM users WHERE email=?', email);
  // constant-ish work even when the user doesn't exist
  const ok = bcrypt.compareSync(String(password || ''), u ? u.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!u || !ok) return res.status(401).json({ error: 'Incorrect email or password' });
  if (u.status === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact support.' });
  q.run("UPDATE users SET last_login=datetime('now') WHERE id=?", u.id);
  setCookie(res, sign(u));
  res.json({ ok: true, role: u.role });
});

router.post('/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

router.get('/me', (req, res) => {
  requireAuth(req, res, () => res.json({ user: req.user }));
});

router.put('/me', requireAuth, (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Name is required' });
  q.run('UPDATE users SET name=?,phone=?,company=?,country=?,gst=? WHERE id=?', name, str(b.phone, 30), str(b.company, 120), str(b.country, 60), str(b.gst, 30), req.user.id);
  res.json({ ok: true });
});

router.put('/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const u = q.get('SELECT password_hash FROM users WHERE id=?', req.user.id);
  if (!bcrypt.compareSync(String(current || ''), u.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!strongEnough(next)) return res.status(400).json({ error: 'New password needs 8+ characters with letters and numbers' });
  q.run('UPDATE users SET password_hash=? WHERE id=?', bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
