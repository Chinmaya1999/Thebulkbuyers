const jwt = require('jsonwebtoken');
const { q } = require('./db');

const COOKIE = 'tbb_token';
const sign = u => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const setCookie = (res, token) => res.cookie(COOKIE, token, {
  httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5, path: '/'
});

function load(req) {
  const t = req.cookies && req.cookies[COOKIE];
  if (!t) return null;
  try {
    const { id } = jwt.verify(t, process.env.JWT_SECRET);
    const u = q.get('SELECT id,name,email,phone,company,country,gst,role,status,referral_code,created_at FROM users WHERE id=?', id);
    return u && u.status !== 'suspended' ? u : null;
  } catch { return null; }
}
const optionalAuth = (req, res, next) => { req.user = load(req); next(); };
const requireAuth = (req, res, next) => {
  req.user = load(req);
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  next();
};
const requireRole = (...roles) => (req, res, next) =>
  requireAuth(req, res, () => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed for your role' }));

const notify = (userId, text, link = '') => q.run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)', userId, text, link);
const notifyAdmins = (text, link = '') => q.all("SELECT id FROM users WHERE role='admin'").forEach(a => notify(a.id, text, link));

module.exports = { sign, setCookie, COOKIE, optionalAuth, requireAuth, requireRole, notify, notifyAdmins };
