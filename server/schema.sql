CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, email TEXT NOT NULL,
  phone TEXT DEFAULT '', company TEXT DEFAULT '', country TEXT DEFAULT 'India', gst TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN('admin','buyer','seller','agent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','pending','suspended')),
  referral_code TEXT UNIQUE, referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(), last_login TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users(lower(email));
CREATE TABLE IF NOT EXISTS categories(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, blurb TEXT DEFAULT '', color TEXT DEFAULT '#ff5a2c',
  image TEXT DEFAULT '', sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products(
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category TEXT REFERENCES categories(id), name TEXT NOT NULL,
  fabric TEXT DEFAULT '', gsm INTEGER DEFAULT 0, fit TEXT DEFAULT '', sizes TEXT DEFAULT 'S–3XL',
  moq INTEGER DEFAULT 100, price_min DOUBLE PRECISION DEFAULT 0, price_max DOUBLE PRECISION DEFAULT 0, lead_days INTEGER DEFAULT 30,
  colors JSONB DEFAULT '[]', description TEXT DEFAULT '', image TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
  featured INTEGER DEFAULT 0, views INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rfqs(
  id SERIAL PRIMARY KEY, buyer_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, category TEXT,
  title TEXT NOT NULL, quantity INTEGER NOT NULL, target_price DOUBLE PRECISION DEFAULT 0,
  destination TEXT DEFAULT '', needed_by TEXT DEFAULT '', notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','accepted','closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quotes(
  id SERIAL PRIMARY KEY, rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id), price DOUBLE PRECISION NOT NULL, lead_days INTEGER DEFAULT 30,
  notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(rfq_id, seller_id)
);
CREATE TABLE IF NOT EXISTS orders(
  id SERIAL PRIMARY KEY, rfq_id INTEGER REFERENCES rfqs(id), quote_id INTEGER REFERENCES quotes(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id), seller_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price DOUBLE PRECISION NOT NULL, total DOUBLE PRECISION NOT NULL,
  commission DOUBLE PRECISION DEFAULT 0, destination TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN('confirmed','in_production','quality_check','shipped','delivered','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications(
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, link TEXT DEFAULT '', read INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inquiries(
  id SERIAL PRIMARY KEY, name TEXT, email TEXT, phone TEXT DEFAULT '', company TEXT DEFAULT '',
  message TEXT, status TEXT DEFAULT 'new' CHECK(status IN('new','handled')), created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wishlist(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, PRIMARY KEY(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category, status);
CREATE INDEX IF NOT EXISTS idx_rfq_buyer ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_rfq ON quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_orders_b ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_s ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);

-- B2C (retail) support
ALTER TABLE products ADD COLUMN IF NOT EXISTS retail_price DOUBLE PRECISION DEFAULT 0;
UPDATE products SET retail_price = ROUND(price_max * 2.2 / 10) * 10 - 1 WHERE COALESCE(retail_price, 0) = 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'wholesale';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS details TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping JSONB;

-- Catalogue hierarchy (group → category → product type) and product master attributes
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS age_group TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS pattern TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate DOUBLE PRECISION DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DOUBLE PRECISION DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_qty INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_uq ON products(sku) WHERE sku IS NOT NULL AND sku <> '';
CREATE INDEX IF NOT EXISTS idx_products_sub ON products(subcategory);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- B2B ordering: variant matrix, GST, gallery, saved addresses
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_options JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lines JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_amount DOUBLE PRECISION DEFAULT 0;
UPDATE orders o SET product_id = r.product_id FROM rfqs r WHERE o.rfq_id = r.id AND o.product_id IS NULL AND r.product_id IS NOT NULL;
UPDATE orders o SET product_id = (SELECT p.id FROM products p WHERE p.name = o.title ORDER BY p.id LIMIT 1) WHERE o.product_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_legal_name TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS addresses(
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT DEFAULT '', name TEXT DEFAULT '', phone TEXT DEFAULT '', line1 TEXT DEFAULT '', line2 TEXT DEFAULT '',
  city TEXT DEFAULT '', state TEXT DEFAULT '', pincode TEXT DEFAULT '', country TEXT DEFAULT 'India', is_default INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addr_user ON addresses(user_id);

-- Admin-managed operations: payments, shipment tracking, notes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount DOUBLE PRECISION DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_no TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';

-- Authentication hardening: session revocation, lockout, audit trail
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS audit_log(
  id SERIAL PRIMARY KEY, user_id INTEGER, user_email TEXT, method TEXT, path TEXT, status INTEGER, ip TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer-specific pricing: negotiated % off the wholesale tier price, set by admin per buyer
ALTER TABLE users ADD COLUMN IF NOT EXISTS discount_pct DOUBLE PRECISION NOT NULL DEFAULT 0;
