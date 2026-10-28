import { ArrowRight, ScanSearch } from 'lucide-react';

export default function EmptyState({ title = 'Your findings will appear here', description = 'Paste a snippet or load a sample, then run a review to inspect bugs and security issues.', actionLabel, onAction }) { return <div className="empty-state"><span className="empty-icon"><ScanSearch size={23} /></span><h3>{title}</h3><p>{description}</p>{actionLabel && <button className="text-action" onClick={onAction}>{actionLabel}<ArrowRight size={14} /></button>}<div className="empty-rule"><span />LOCAL ANALYSIS<span /></div></div>; }
