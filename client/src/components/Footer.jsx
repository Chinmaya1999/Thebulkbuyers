import { Link } from 'react-router-dom';
import { useSite } from '../site.js';
import { Logo } from './Header.jsx';
import { useToast } from '../toast.jsx';

export default function Footer() {
  const toast = useToast(), { contact: C, footer: F } = useSite();
  return <><footer className="footer"><div className="container">
    <div className="news"><div><h3 className="h-md" style={{ color: '#fff' }}>{F.newsletterTitle}</h3><p style={{ color: '#9d988a', marginTop: 6 }}>{F.newsletterText}</p></div>
      <form onSubmit={e => { e.preventDefault(); toast('Thanks — we’ll be in touch'); e.target.reset(); }} style={{ display: 'flex', gap: 0, flex: '1 1 340px', maxWidth: 480 }}><input type="email" required placeholder="Business email" aria-label="Business email" style={{ background: 'transparent', color: '#fff', borderColor: '#555' }} /><button className="btn light" type="submit">Subscribe</button></form></div>
    <div className="fgrid">
      <div><Logo light /><p className="legal">{F.legal.split('\n').map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}</p></div>
      <div><h5>Shop</h5><ul><li><Link to="/shop?sort=new">New arrivals</Link></li><li><Link to="/shop?sort=bestseller">Best sellers</Link></li><li><Link to="/shop?sort=deal">Wholesale deals</Link></li><li><Link to="/categories">All categories</Link></li></ul></div>
      <div><h5>For business</h5><ul><li><Link to="/register?role=buyer">Create business account</Link></li><li><Link to="/dashboard/quotations">Request a quotation</Link></li></ul></div>
      <div><h5>Company</h5><ul><li><Link to="/about">About</Link></li><li><Link to="/contact">Contact</Link></li><li><a href="https://bulkbuyers.in" target="_blank" rel="noreferrer">Corporate site</a></li><li><a href={'tel:' + C.phone.replace(/\s/g, '')}>{C.phone}</a></li><li><a href={'mailto:' + C.email}>{C.email}</a></li></ul></div>
    </div>
    <div className="fbot"><span>© {new Date().getFullYear()} Bulk Buyers. All rights reserved.</span><span>Wholesale garments · apparel · footwear · accessories</span></div>
  </div></footer>
  <a className="wa" href={`https://wa.me/${C.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1.1.1-3.6-.9-3-1.3-4.9-4.4-5.1-4.6-.1-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.3.8-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.6-.1 1.1z" /></svg></a></>;
}
