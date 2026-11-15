export const CardSkeleton = () => <div className="skel-card"><div className="a skel" /><div className="b skel" /><div className="c skel" /></div>;
export const GridSkeleton = ({ n = 8, wide }) => <div className={'pgrid' + (wide ? ' wide' : '')}>{Array.from({ length: n }, (_, i) => <CardSkeleton key={i} />)}</div>;
