import { useRef } from 'react';
import * as Ic from './icons.jsx';
export default function Carousel({ children, label }) {
  const ref = useRef();
  const go = d => ref.current.scrollBy({ left: d * ref.current.clientWidth * .85, behavior: 'smooth' });
  return <div className="car" role="region" aria-label={label}><div className="car-track" ref={ref}>{children}</div>
    <div className="car-btns" style={{ marginTop: 18 }}><button onClick={() => go(-1)} aria-label="Previous"><Ic.Left /></button><button onClick={() => go(1)} aria-label="Next"><Ic.Right /></button></div></div>;
}
