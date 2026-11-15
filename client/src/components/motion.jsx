import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from 'framer-motion';
export { m, AnimatePresence, useReducedMotion };
// Single feature bundle for the whole app (keeps Framer Motion small).
export const Motion = ({ children }) => <LazyMotion features={domAnimation} strict>{children}</LazyMotion>;
// Scroll reveal: fade + rise once as it enters the viewport.
export function Reveal({ children, delay = 0, y = 24, as = 'div', className, ...rest }) {
  const reduce = useReducedMotion(), Tag = m[as];
  return <Tag className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -60px 0px' }} transition={{ duration: .8, delay, ease: [.22, .8, .2, 1] }} {...rest}>{children}</Tag>;
}
export const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: .25 } };
