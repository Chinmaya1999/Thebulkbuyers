#!/usr/bin/env bash
# Exports every table to database/export/*.csv and writes database/DATABASE_OVERVIEW.md  (npm run db:export)
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}/psql"
p(){ "$PSQL" -h 127.0.0.1 -p "${DB_PORT:-54329}" -U bulkbuyers -d bulkbuyers -q "$@"; }
mkdir -p database/export
ex(){ p -c "\\copy ($2) to 'database/export/$1.csv' csv header"; }
ex users "select id,name,email,phone,company,country,gst,gst_legal_name,role,status,referral_code,referred_by,created_at,last_login from users order by id"
ex categories "select * from categories order by level, sort"
ex products "select p.id,p.sku,p.slug,p.name,c.name as category,sc.name as product_type,u.company as manufacturer,p.gender,p.age_group,p.season,p.pattern,p.fabric,p.gsm,p.fit,p.sizes,p.colors,p.moq,p.price_min,p.price_max,p.retail_price,p.gst_rate,p.hsn_code,p.stock_qty,p.lead_days,p.status,p.featured,p.views,p.image,p.description,p.created_at from products p left join categories c on c.id=p.category left join categories sc on sc.id=p.subcategory left join users u on u.id=p.seller_id order by p.id"
for t in orders rfqs quotes addresses notifications inquiries; do ex $t "select * from $t order by id"; done
ex wishlist "select * from wishlist"
ex images "select id,mime,length(data) as bytes,created_at from images"
{
  echo "# Bulk Buyers database — overview"; echo
  echo "Generated $(date '+%Y-%m-%d %H:%M'). Connection: \`127.0.0.1:54329 / bulkbuyers / user bulkbuyers\` (no password)."; echo
  echo "| Table | Rows | Columns |"; echo "|---|---|---|"
  for t in $(p -Atc "select table_name from information_schema.tables where table_schema='public' order by 1"); do
    n=$(p -Atc "select count(*) from $t")
    cols=$(p -Atc "select string_agg(column_name||' ('||data_type||')', ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='$t'")
    echo "| **$t** | $n | $cols |"
  done
  echo; echo "Each table is exported as CSV in \`database/export/\` (password hashes, secrets and photo bytes are excluded)."
} > database/DATABASE_OVERVIEW.md
echo "Exported to database/export/ and database/DATABASE_OVERVIEW.md"
