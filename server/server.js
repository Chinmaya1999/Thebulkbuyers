require('dotenv').config();
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { q, getSetting } = require('./db');
const seed = require('./seed');

const PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, '..', 'client', 'dist');

async function main() {
  await seed.run(); // migrates schema, seeds categories/admin (+demo data outside production)
  if (!process.env.JWT_SECRET) {
    let s = await getSetting('jwt_secret', null);
    if (!s) { s = crypto.randomBytes(48).toString('hex'); await q.run("INSERT INTO settings(key,value) VALUES('jwt_secret',?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", s); }
    process.env.JWT_SECRET = s;
  }

  const app = express();
  app.set('trust proxy', 1);
  const HTTP_ONLY = process.env.COOKIE_SECURE === 'false'; // plain-HTTP deployment (no TLS yet): don't force https
  app.use(helmet({
    hsts: !HTTP_ONLY,
    contentSecurityPolicy: {
      directives: {
        ...(HTTP_ONLY ? { upgradeInsecureRequests: null } : {}),
        defaultSrc: ["'self'"], scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
        mediaSrc: ["'self'", 'blob:'], connectSrc: ["'self'"], workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"], frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  // NUL bytes are never valid input (and make Postgres throw) — reject them up front.
  app.use((req, res, next) => (/%00/i.test(req.url) ? res.status(400).json({ error: 'Invalid request' }) : next()));

  const lim = (windowMs, limit, extra = {}) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, ...extra });
  app.use('/api', lim(60_000, Number(process.env.API_LIMIT || 300)));
  // CSRF defence in depth (cookies are SameSite=Lax): browsers send Origin on unsafe requests; reject cross-site ones.
  const allowed = new Set((process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean));
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const o = req.get('origin');
    if (!o) return next();
    try {
      const u = new URL(o), fwd = (req.get('x-forwarded-host') || '').split(',')[0].trim();
      const devLocal = !PROD && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname); // Vite dev server (:5173) proxies to this API
      if (u.host === req.get('host') || (fwd && u.host === fwd) || devLocal || allowed.has(o)) return next();
    } catch { /* fall through */ }
    res.status(403).json({ error: 'Cross-site request blocked' });
  });
  app.use('/api/auth/login', lim(15 * 60_000, Number(process.env.LOGIN_LIMIT || 25), { message: { error: 'Too many attempts, try again later.' } }));
  app.use('/api/auth/register', lim(60 * 60_000, Number(process.env.REGISTER_LIMIT || 20)));

  app.get('/healthz', async (_, res) => { await q.get('SELECT 1'); res.json({ ok: true }); });
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', require('./routes/public'));
  app.get('/uploads/:id', require('./routes/public').serveUpload);
  app.use('/api', require('./routes/trade'));
  app.use('/api/account', require('./routes/account'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  const origin = req => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nDisallow: /dashboard\nDisallow: /api/\nDisallow: /checkout\nSitemap: ${origin(req)}/sitemap.xml\n`));
  app.get('/sitemap.xml', async (req, res) => {
    const base = origin(req), esc = s => s.replace(/&/g, '&amp;');
    const prods = await q.all("SELECT slug, created_at FROM products WHERE status='approved' ORDER BY id"), cats = await q.all('SELECT id FROM categories WHERE level=1');
    const urls = ['/', '/shop', '/categories', '/about', '/contact', ...cats.map(c => `/shop?cat=${c.id}`), ...prods.map(p => `/product?p=${p.slug}`)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`);
  });

  // Serve the built React app (client-side routing → index.html).
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST, { index: false, maxAge: PROD ? '1y' : 0, immutable: PROD, setHeaders: (r, f) => { if (f.endsWith('.html')) r.setHeader('Cache-Control', 'no-cache'); } }));
    app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  } else {
    app.get('/', (req, res) => res.type('text').send('API running. Start the React dev server: npm run dev (client on :5173)'));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (['22021', '22P05', '22P02', '22003'].includes(err.code)) err.status = 400, err.message = 'Invalid input'; // bad bytes / types / out-of-range from the client
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : (PROD ? 'Something went wrong' : err.message) });
  });

  app.listen(PORT, () => console.log(`The Bulk Buyers API → http://localhost:${PORT}`));
}
main().catch(e => { console.error('Failed to start:', e); process.exit(1); });
