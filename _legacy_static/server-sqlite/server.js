const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const { q, DATA_DIR, getSetting } = require('./db');
const seed = require('./seed');

const PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Persisted random JWT secret unless one is supplied via env.
if (!process.env.JWT_SECRET) {
  let s = getSetting('jwt_secret', null);
  if (!s) { s = crypto.randomBytes(48).toString('hex'); q.run("INSERT OR REPLACE INTO settings(key,value) VALUES('jwt_secret',?)", s); }
  process.env.JWT_SECRET = s;
}
seed.run();

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"], frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later.' } }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

app.get('/healthz', (_, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/trade'));
app.use('/api/seller', require('./routes/seller'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d', immutable: true, setHeaders: r => r.setHeader('X-Content-Type-Options', 'nosniff') }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: PROD ? '1h' : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 8MB)' });
  console.error(err);
  res.status(err.status || 500).json({ error: PROD ? 'Something went wrong' : err.message });
});

app.listen(PORT, () => console.log(`The Bulk Buyers running → http://localhost:${PORT}`));
