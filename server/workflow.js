// RFQ → order workflow shared by the buyer and admin routes.
const { q, getSetting } = require('./db');
const { notify, notifyAdmins } = require('./auth');
const { num } = require('./util');
const inr = n => (Number(n) / 88).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // INR → USD for display

// Accepts a quote: rejects the other quotes, closes the RFQ, creates the order. Returns the new order id.
async function acceptQuote(qt) {
  const pct = num(await getSetting('commission_pct', '3'), 3) / 100;
  const total = Math.round(qt.price * qt.quantity);
  const orderId = await q.tx(async t => {
    const lock = await t.get('SELECT status FROM rfqs WHERE id=? FOR UPDATE', qt.rfq_id);
    if (lock.status !== 'open') { const e = new Error('This RFQ was already accepted'); e.status = 400; throw e; }
    await t.run("UPDATE quotes SET status='accepted' WHERE id=?", qt.id);
    for (const o of await t.all("SELECT seller_id FROM quotes WHERE rfq_id=? AND id!=? AND status='pending'", qt.rfq_id, qt.id)) await notify(o.seller_id, `Another quote was chosen for "${qt.title}"`, '#rfqs', t);
    await t.run("UPDATE quotes SET status='rejected' WHERE rfq_id=? AND id!=? AND status='pending'", qt.rfq_id, qt.id);
    await t.run("UPDATE rfqs SET status='accepted' WHERE id=?", qt.rfq_id);
    return t.insert('INSERT INTO orders(rfq_id,quote_id,buyer_id,seller_id,product_id,title,quantity,unit_price,total,commission,destination) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      qt.rfq_id, qt.id, qt.buyer_id, qt.seller_id, qt.rfq_product_id, qt.title, qt.quantity, qt.price, total, Math.round(total * pct), qt.destination);
  });
  await notify(qt.buyer_id, `Your quotation "${qt.title}" is confirmed — order #${orderId} ($${inr(total)})`, '#orders');
  await notifyAdmins(`Order #${orderId} confirmed — $${inr(total)}`, '#orders');
  return orderId;
}

const quoteForAccept = id => q.get('SELECT qt.*, r.buyer_id, r.title, r.quantity, r.destination, r.product_id rfq_product_id, r.status rfq_status FROM quotes qt JOIN rfqs r ON r.id=qt.rfq_id WHERE qt.id=?', id);

module.exports = { acceptQuote, quoteForAccept };
