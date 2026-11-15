// Tiny validation helpers (no deps).
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const int = (v, d = 0) => Math.trunc(num(v, d));
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const parseColors = v => {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return arr.map(c => String(c).trim()).filter(c => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 12);
};
const page = (req, def = 24) => {
  const limit = Math.min(100, Math.max(1, int(req.query.limit, def)));
  const p = Math.max(1, int(req.query.page, 1));
  return { limit, offset: (p - 1) * limit, page: p };
};
const hydrateProduct = p => p && ({ ...p, colors: JSON.parse(p.colors || '[]') });
module.exports = { str, num, int, isEmail, slugify, parseColors, page, hydrateProduct };
