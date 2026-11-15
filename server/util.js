const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const int = (v, d = 0) => Math.trunc(num(v, d));
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const parseColors = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(c => String(c).trim()).filter(c => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 12);
const page = (req, def = 24) => {
  const limit = Math.min(100, Math.max(1, int(req.query.limit, def)));
  const p = Math.max(1, int(req.query.page, 1));
  return { limit, offset: (p - 1) * limit, page: p };
};
// Turn a free-text size range ("S–3XL", "UK 6–11", "2Y–10Y", "0–3M, 3–6M", "Free size") into selectable options.
const parseSizes = (sizes = '') => {
  const t = String(sizes).trim(), STD = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  let m = t.match(/^(XS|S|M|L|XL|XXL|3XL)\s*[–-]\s*(XS|S|M|L|XL|XXL|3XL)$/i);
  if (m) { const a = STD.indexOf(m[1].toUpperCase()), b = STD.indexOf(m[2].toUpperCase()); if (a >= 0 && b >= a) return STD.slice(a, b + 1); }
  m = t.match(/^(UK\s*)?(\d+)\s*[–-]\s*(\d+)$/i);
  if (m && +m[3] - +m[2] <= 20) return Array.from({ length: +m[3] - +m[2] + 1 }, (_, i) => (m[1] ? 'UK ' : '') + (+m[2] + i));
  m = t.match(/^(\d+)\s*Y\s*[–-]\s*(\d+)\s*Y$/i);
  if (m) { const out = []; for (let y = +m[1]; y <= +m[2]; y += 2) out.push(y + 'Y'); return out; }
  if (t.includes(',')) return t.split(',').map(x => x.trim()).filter(Boolean);
  return [t || 'Free size'];
};
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
module.exports = { parseSizes, GSTIN_RE, str, num, int, isEmail, slugify, parseColors, page };
