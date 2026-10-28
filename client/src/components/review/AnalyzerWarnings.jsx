import { Info } from 'lucide-react';

export default function AnalyzerWarnings({ warnings = [] }) { if (!warnings.length) return null; return <div className="warning-stack" aria-label="Review warnings">{warnings.map((warning, index) => <div key={`${warning}-${index}`} className="warning-notice"><Info size={14} /><span>{warning}</span></div>)}</div>; }
