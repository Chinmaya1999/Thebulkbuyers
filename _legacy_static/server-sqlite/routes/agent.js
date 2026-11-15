const router = require('express').Router();
const { q, getSetting } = require('../db');
const { requireRole } = require('../auth');
router.use(requireRole('agent'));

router.get('/summary', (req, res) => {
  const rate = Number(getSetting('agent_commission_pct', '1')) / 100;
  const referrals = q.all(`SELECT u.id,u.name,u.company,u.role,u.status,u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE (o.buyer_id=u.id OR o.seller_id=u.id) AND o.status!='cancelled') orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE (o.buyer_id=u.id) AND o.status='delivered') delivered_value
    FROM users u WHERE u.referred_by=? ORDER BY u.id DESC`, req.user.id);
  const delivered = referrals.reduce((s, r) => s + r.delivered_value, 0);
  const pending = q.get("SELECT COALESCE(SUM(o.total),0) v FROM orders o JOIN users b ON b.id=o.buyer_id WHERE b.referred_by=? AND o.status IN('confirmed','in_production','quality_check','shipped')", req.user.id).v;
  const monthly = q.all("SELECT strftime('%Y-%m',o.created_at) m, SUM(o.total) v FROM orders o JOIN users b ON b.id=o.buyer_id WHERE b.referred_by=? AND o.status!='cancelled' GROUP BY m ORDER BY m DESC LIMIT 8", req.user.id).reverse();
  res.json({ code: req.user.referral_code, rate: rate * 100, referrals, earned: Math.round(delivered * rate), pending: Math.round(pending * rate), tradeValue: delivered + pending, monthly });
});
module.exports = router;
