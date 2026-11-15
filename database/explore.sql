-- ============================================================================
--  Bulk Buyers — explore the whole database
--  Connection: 127.0.0.1 : 54329 · database bulkbuyers · user bulkbuyers · no password
--  In VS Code (PostgreSQL extension): connect, then select a block and Run Query
--  (right-click → Run Query).  Every block is independent.
-- ============================================================================

-- 1) ALL TABLES with row counts and size ---------------------------------------
SELECT c.relname AS table_name,
       (xpath('/row/c/text()', query_to_xml('select count(*) as c from '||quote_ident(c.relname), false, true, '')))[1]::text::int AS rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname;

-- 2) EVERY COLUMN of every table (name, type, nullable, default) ----------------
SELECT table_name, ordinal_position AS "#", column_name, data_type, is_nullable AS nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;

-- 3) RELATIONSHIPS (foreign keys) ----------------------------------------------
SELECT conrelid::regclass AS table_name, conname AS constraint_name, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace ORDER BY 1, 2;

-- ============================================================================
--  RAW TABLE DATA (first 200 rows each)
-- ============================================================================
SELECT * FROM users          ORDER BY id LIMIT 200;   -- password_hash is bcrypt (not readable)
SELECT * FROM categories     ORDER BY level, sort LIMIT 200;
SELECT * FROM products       ORDER BY id LIMIT 200;
SELECT * FROM orders         ORDER BY id DESC LIMIT 200;
SELECT * FROM rfqs           ORDER BY id DESC LIMIT 200;
SELECT * FROM quotes         ORDER BY id DESC LIMIT 200;
SELECT * FROM addresses      ORDER BY id DESC LIMIT 200;
SELECT * FROM wishlist       LIMIT 200;
SELECT * FROM notifications  ORDER BY id DESC LIMIT 200;
SELECT * FROM inquiries      ORDER BY id DESC LIMIT 200;
SELECT id, mime, length(data) AS bytes, created_at FROM images ORDER BY created_at DESC LIMIT 200;  -- uploaded photos
SELECT key, CASE WHEN key = 'jwt_secret' THEN '(hidden)' ELSE value END AS value FROM settings;

-- ============================================================================
--  READABLE OVERVIEWS (joined, human-friendly)
-- ============================================================================

-- Users by role and status
SELECT role, status, count(*) AS users FROM users GROUP BY role, status ORDER BY role, status;

-- Catalogue tree: group → category → product types with product counts
SELECT g.name AS "group", c.name AS category, t.name AS product_type,
       (SELECT count(*) FROM products p WHERE p.subcategory = t.id) AS products
FROM categories t JOIN categories c ON c.id = t.parent_id JOIN categories g ON g.id = c.parent_id
WHERE t.level = 2 ORDER BY g.sort, c.sort, t.sort;

-- Products with category, type, manufacturer, pricing and stock
SELECT p.id, p.sku, p.name, c.name AS category, sc.name AS product_type, u.company AS manufacturer,
       p.gender, p.age_group, p.season, p.fabric, p.sizes, p.moq,
       p.price_min, p.price_max, p.retail_price, p.gst_rate, p.hsn_code,
       CASE WHEN p.stock_qty = 0 THEN 'made to order' ELSE p.stock_qty::text END AS stock, p.status
FROM products p LEFT JOIN categories c ON c.id = p.category LEFT JOIN categories sc ON sc.id = p.subcategory LEFT JOIN users u ON u.id = p.seller_id
ORDER BY p.id;

-- Products per category
SELECT c.name AS category, count(*) AS products, min(p.price_min) AS cheapest, max(p.price_max) AS dearest
FROM products p JOIN categories c ON c.id = p.category GROUP BY c.name ORDER BY products DESC;

-- Orders with buyer, manufacturer, product, totals incl. GST
SELECT o.id, o.created_at::date AS date, o.channel, o.status, b.company AS buyer, s.company AS manufacturer,
       o.title, o.quantity, o.unit_price, o.total AS taxable, o.gst_amount, (o.total + COALESCE(o.gst_amount,0)) AS grand_total, o.destination, o.lines
FROM orders o JOIN users b ON b.id = o.buyer_id JOIN users s ON s.id = o.seller_id ORDER BY o.id DESC;

-- Sales by month
SELECT to_char(created_at,'YYYY-MM') AS month, count(*) AS orders, sum(total) AS taxable_value, sum(commission) AS platform_commission
FROM orders WHERE status <> 'cancelled' GROUP BY 1 ORDER BY 1;

-- Quotation requests (RFQs) with how many quotes each received
SELECT r.id, r.created_at::date AS date, b.company AS buyer, r.title, r.quantity, r.target_price, r.status,
       (SELECT count(*) FROM quotes q WHERE q.rfq_id = r.id) AS quotes
FROM rfqs r JOIN users b ON b.id = r.buyer_id ORDER BY r.id DESC;

-- Quotes with manufacturer
SELECT q.id, q.rfq_id, s.company AS manufacturer, q.price, q.lead_days, q.status, q.notes FROM quotes q JOIN users s ON s.id = q.seller_id ORDER BY q.id DESC;
