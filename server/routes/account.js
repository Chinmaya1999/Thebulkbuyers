const router = require('express').Router();
const { q } = require('../db');
const { requireAuth } = require('../auth');
const { str, int } = require('../util');
router.use(requireAuth);

const clean = b => ({ label: str(b.label, 40), name: str(b.name, 80), phone: str(b.phone, 30), line1: str(b.line1, 200), line2: str(b.line2, 120), city: str(b.city, 80), state: str(b.state, 60), pincode: str(b.pincode, 12), country: str(b.country, 60) || 'India' });
const check = a => !a.name ? 'Name is required' : a.phone.length < 7 ? 'Enter a valid phone number' : a.line1.length < 4 ? 'Address is required' : !a.city ? 'City is required' : null;

router.get('/addresses', async (req, res) => res.json(await q.all('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC', req.user.id)));
router.post('/addresses', async (req, res) => {
  const a = clean(req.body || {}), err = check(a); if (err) return res.status(400).json({ error: err });
  const first = !(await q.get('SELECT 1 x FROM addresses WHERE user_id=?', req.user.id));
  const id = await q.insert('INSERT INTO addresses(user_id,label,name,phone,line1,line2,city,state,pincode,country,is_default) VALUES(?,?,?,?,?,?,?,?,?,?,?)', req.user.id, a.label, a.name, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, a.country, first ? 1 : 0);
  res.status(201).json({ ok: true, id });
});
router.put('/addresses/:id', async (req, res) => {
  const a = clean(req.body || {}), err = check(a); if (err) return res.status(400).json({ error: err });
  const r = await q.run('UPDATE addresses SET label=?,name=?,phone=?,line1=?,line2=?,city=?,state=?,pincode=?,country=? WHERE id=? AND user_id=?', a.label, a.name, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, a.country, int(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Address not found' });
});
router.put('/addresses/:id/default', async (req, res) => {
  const id = int(req.params.id); if (!(await q.get('SELECT 1 x FROM addresses WHERE id=? AND user_id=?', id, req.user.id))) return res.status(404).json({ error: 'Address not found' });
  await q.tx(async t => { await t.run('UPDATE addresses SET is_default=0 WHERE user_id=?', req.user.id); await t.run('UPDATE addresses SET is_default=1 WHERE id=?', id); });
  res.json({ ok: true });
});
router.delete('/addresses/:id', async (req, res) => { await q.run('DELETE FROM addresses WHERE id=? AND user_id=?', int(req.params.id), req.user.id); res.json({ ok: true }); });
module.exports = router;
