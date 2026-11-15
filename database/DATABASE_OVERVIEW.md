# Bulk Buyers database — overview

Generated 2026-11-15 11:44. Connection: `127.0.0.1:54329 / bulkbuyers / user bulkbuyers` (no password).

| Table | Rows | Columns |
|---|---|---|
| **addresses** | 0 | id (integer), user_id (integer), label (text), name (text), phone (text), line1 (text), line2 (text), city (text), state (text), pincode (text), country (text), is_default (integer), created_at (timestamp with time zone) |
| **categories** | 293 | id (text), name (text), blurb (text), color (text), image (text), sort (integer), parent_id (text), level (integer) |
| **images** | 0 | id (text), mime (text), data (bytea), created_at (timestamp with time zone) |
| **inquiries** | 1 | id (integer), name (text), email (text), phone (text), company (text), message (text), status (text), created_at (timestamp with time zone) |
| **notifications** | 1 | id (integer), user_id (integer), text (text), link (text), read (integer), created_at (timestamp with time zone) |
| **orders** | 22 | id (integer), rfq_id (integer), quote_id (integer), buyer_id (integer), seller_id (integer), title (text), quantity (integer), unit_price (double precision), total (double precision), commission (double precision), destination (text), status (text), created_at (timestamp with time zone), updated_at (timestamp with time zone), channel (text), details (text), shipping (jsonb), product_id (integer), lines (jsonb), gst_amount (double precision) |
| **products** | 285 | id (integer), slug (text), seller_id (integer), category (text), name (text), fabric (text), gsm (integer), fit (text), sizes (text), moq (integer), price_min (double precision), price_max (double precision), lead_days (integer), colors (jsonb), description (text), image (text), status (text), featured (integer), views (integer), created_at (timestamp with time zone), retail_price (double precision), subcategory (text), sku (text), brand (text), gender (text), age_group (text), pattern (text), season (text), hsn_code (text), gst_rate (double precision), purchase_price (double precision), stock_qty (integer), barcode (text), gallery (jsonb), size_options (jsonb) |
| **quotes** | 22 | id (integer), rfq_id (integer), seller_id (integer), price (double precision), lead_days (integer), notes (text), status (text), created_at (timestamp with time zone) |
| **rfqs** | 26 | id (integer), buyer_id (integer), product_id (integer), category (text), title (text), quantity (integer), target_price (double precision), destination (text), needed_by (text), notes (text), status (text), created_at (timestamp with time zone) |
| **settings** | 1 | key (text), value (text) |
| **users** | 14 | id (integer), name (text), email (text), phone (text), company (text), country (text), gst (text), password_hash (text), role (text), status (text), referral_code (text), referred_by (integer), created_at (timestamp with time zone), last_login (timestamp with time zone), gst_legal_name (text) |
| **wishlist** | 0 | user_id (integer), product_id (integer) |

Each table is exported as CSV in `database/export/` (password hashes, secrets and photo bytes are excluded).
