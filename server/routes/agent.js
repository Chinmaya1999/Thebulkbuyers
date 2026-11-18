// Agent dashboard API: referral code, referred buyers and commission on their delivered orders.
const router = require('express').Router();
const { q, getSetting } = require('../db');
const { requireRole } = require('../auth');
const { num } = require('../util');

router.use(requireRole('agent'));

router.get('/summary', async (req, res) => {
  const rate = num(await getSetting('agent_commission_pct', '1'), 1) / 100;
  const me = await q.get('SELECT referral_code FROM users WHERE id=?', req.user.id);
  const buyers = await q.all(`SELECT b.id, b.name, b.company, b.status, b.created_at,
      COUNT(o.id) FILTER (WHERE o.status!='cancelled') orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.status='delivered'),0) delivered,
      COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('delivered','cancelled')),0) in_progress,
      MAX(o.created_at) last_order
    FROM users b LEFT JOIN orders o ON o.buyer_id=b.id WHERE b.referred_by=? GROUP BY b.id ORDER BY b.created_at DESC`, req.user.id);
  const orders = await q.all(`SELECT o.id, o.title, o.quantity, o.total, o.status, o.created_at, b.name buyer_name, b.company buyer_company
    FROM orders o JOIN users b ON b.id=o.buyer_id WHERE b.referred_by=? AND o.status!='cancelled' ORDER BY o.id DESC LIMIT 500`, req.user.id);
  const withEarn = orders.map(o => ({ ...o, earned: o.status === 'delivered' ? Math.round(o.total * rate) : 0, expected: Math.round(o.total * rate) }));
  const delivered = withEarn.filter(o => o.status === 'delivered');
  res.json({
    code: me.referral_code, rate_pct: rate * 100, buyers, orders: withEarn,
    totals: {
      buyers: buyers.length, orders: orders.length, delivered_value: delivered.reduce((s, o) => s + o.total, 0),
      earned: delivered.reduce((s, o) => s + o.earned, 0),
      pending: withEarn.filter(o => o.status !== 'delivered').reduce((s, o) => s + o.expected, 0)
    }
  });
});

module.exports = router;
