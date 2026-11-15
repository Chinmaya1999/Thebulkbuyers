const { Pool, types } = require('pg');
const fs = require('fs');
const path = require('path');

// bigint (COUNT/SUM) and numeric come back as numbers instead of strings.
types.setTypeParser(20, v => parseInt(v, 10));
types.setTypeParser(1700, v => parseFloat(v));

if (!process.env.DATABASE_URL) {
  console.error('\nDATABASE_URL is not set.\nCreate a file named .env in the project root (copy .env.example) containing:\n  DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/bulkbuyers\n');
  process.exit(1);
}
const useSsl = process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=require/, ''),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX || 10)
});
pool.on('error', e => console.error('pg pool error', e.message));

// Lets route code keep readable `?` placeholders → $1, $2 …
const conv = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
const api = run => ({
  all: async (sql, ...p) => (await run(conv(sql), p)).rows,
  get: async (sql, ...p) => (await run(conv(sql), p)).rows[0],
  run: async (sql, ...p) => { const r = await run(conv(sql), p); return { changes: r.rowCount, rows: r.rows }; },
  insert: async (sql, ...p) => (await run(conv(sql) + ' RETURNING id', p)).rows[0].id
});
const q = {
  ...api((s, p) => pool.query(s, p)),
  async tx(fn) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(api((s, p) => c.query(s, p)));
      await c.query('COMMIT');
      return r;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
};
const getSetting = async (k, d) => (await q.get('SELECT value FROM settings WHERE key=?', k))?.value ?? d;
const migrate = () => pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = { pool, q, getSetting, migrate };
