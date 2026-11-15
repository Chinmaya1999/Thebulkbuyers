const jwt = require('jsonwebtoken');
const { q } = require('./db');

const COOKIE = 'tbb_token';
const sign = u => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const setCookie = (res, token) => res.cookie(COOKIE, token, {
  httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5, path: '/'
});

async function load(req) {
  const t = req.cookies && req.cookies[COOKIE];
  if (!t) return null;
  try {
    const { id } = jwt.verify(t, process.env.JWT_SECRET);
    const u = await q.get('SELECT id,name,email,phone,company,country,gst,gst_legal_name,role,status,referral_code,created_at FROM users WHERE id=?', id);
    // Sellers/agents are records managed by admin — they do not sign in.
    return u && u.status !== 'suspended' && ['admin', 'buyer'].includes(u.role) ? u : null;
  } catch { return null; }
}
const optionalAuth = async (req, res, next) => { req.user = await load(req); next(); };
const requireAuth = async (req, res, next) => {
  req.user = await load(req);
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  next();
};
const requireRole = (...roles) => async (req, res, next) => {
  req.user = await load(req);
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed for your role' });
  next();
};

const notify = (userId, text, link = '', db = q) => db.run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)', userId, text, link);
const notifyAdmins = async (text, link = '', db = q) => { for (const a of await db.all("SELECT id FROM users WHERE role='admin'")) await notify(a.id, text, link, db); };

module.exports = { sign, setCookie, COOKIE, optionalAuth, requireAuth, requireRole, notify, notifyAdmins };
