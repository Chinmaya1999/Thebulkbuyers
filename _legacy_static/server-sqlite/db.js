const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'bulkbuyers.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT DEFAULT '', company TEXT DEFAULT '', country TEXT DEFAULT 'India', gst TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN('admin','buyer','seller','agent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','pending','suspended')),
  referral_code TEXT UNIQUE, referred_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')), last_login TEXT
);
CREATE TABLE IF NOT EXISTS categories(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, blurb TEXT DEFAULT '', color TEXT DEFAULT '#ff5a2c',
  image TEXT DEFAULT '', sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL,
  seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category TEXT REFERENCES categories(id), name TEXT NOT NULL,
  fabric TEXT DEFAULT '', gsm INTEGER DEFAULT 0, fit TEXT DEFAULT '', sizes TEXT DEFAULT 'S–3XL',
  moq INTEGER DEFAULT 100, price_min REAL DEFAULT 0, price_max REAL DEFAULT 0, lead_days INTEGER DEFAULT 30,
  colors TEXT DEFAULT '[]', description TEXT DEFAULT '', image TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
  featured INTEGER DEFAULT 0, views INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rfqs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, category TEXT,
  title TEXT NOT NULL, quantity INTEGER NOT NULL, target_price REAL DEFAULT 0,
  destination TEXT DEFAULT '', needed_by TEXT DEFAULT '', notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','accepted','closed')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quotes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id), price REAL NOT NULL, lead_days INTEGER DEFAULT 30,
  notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','rejected')),
  created_at TEXT DEFAULT (datetime('now')), UNIQUE(rfq_id, seller_id)
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT, rfq_id INTEGER REFERENCES rfqs(id), quote_id INTEGER REFERENCES quotes(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id), seller_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, total REAL NOT NULL,
  commission REAL DEFAULT 0, destination TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN('confirmed','in_production','quality_check','shipped','delivered','cancelled')),
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, link TEXT DEFAULT '', read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS inquiries(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT DEFAULT '', company TEXT DEFAULT '',
  message TEXT, status TEXT DEFAULT 'new' CHECK(status IN('new','handled')), created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wishlist(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, PRIMARY KEY(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category, status);
CREATE INDEX IF NOT EXISTS idx_rfq_buyer ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_b ON orders(buyer_id); CREATE INDEX IF NOT EXISTS idx_orders_s ON orders(seller_id);
`);

// Small helpers around node:sqlite so route code stays terse.
const q = {
  all: (sql, ...p) => db.prepare(sql).all(...p),
  get: (sql, ...p) => db.prepare(sql).get(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
  tx(fn) {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
};
const getSetting = (k, d) => (q.get('SELECT value FROM settings WHERE key=?', k) || { value: d }).value;

module.exports = { db, q, DATA_DIR, getSetting };
