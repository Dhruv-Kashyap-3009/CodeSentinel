import { CircleDot, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function SummaryBar({ report, loading = false }) {
  const summary = report?.summary ?? { high: 0, medium: 0, low: 0, total: 0 };
  const label = loading ? 'ANALYZING' : report?.language ? report.language.toUpperCase() : 'READY';
  const note = loading ? '· local model at work' : report?.cached ? '· cached' : report ? '· analyzed' : '· waiting for code';
  return <div className="summary-bar"><div className="summary-title"><span className="summary-eyebrow">REVIEW REPORT</span><span className="detected-language"><span className={`language-dot${loading ? ' is-live' : ''}`} />{label}<span className="detected-label">{note}</span></span></div><div className="summary-stats"><div className="summary-stat total-stat"><strong>{summary.total}</strong><span>findings</span></div><span className="stat-separator" /><div className="summary-stat stat-high"><span className="stat-marker" /><strong>{summary.high}</strong><span>high</span></div><div className="summary-stat stat-medium"><span className="stat-marker" /><strong>{summary.medium}</strong><span>medium</span></div><div className="summary-stat stat-low"><span className="stat-marker" /><strong>{summary.low}</strong><span>low</span></div></div></div>;
}
