import { useState } from 'react';
import { BadgeCheck, Check, Clipboard, ShieldCheck } from 'lucide-react';
import SeverityBadge from './SeverityBadge.jsx';

export default function IssueCard({ issue, index, selected, onClick }) {
  const [copied, setCopied] = useState(false);
  async function copyFix(event) {
    event.stopPropagation();
    if (!issue.suggestedFix) return;
    await navigator.clipboard.writeText(issue.suggestedFix);
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }
  return <article className={`issue-card${selected ? ' issue-selected' : ''}`}>
    <button className="issue-head" onClick={() => onClick(issue.line)} aria-label={`Show issue at line ${issue.line}`}>
      <span className="issue-number">{String(index + 1).padStart(2, '0')}</span><SeverityBadge severity={issue.severity} /><span className="issue-category">{issue.category}</span><span className="issue-line">L{issue.line}</span>
    </button>
    <p className="issue-explanation">{issue.explanation ?? issue.message}</p>
    {issue.suggestedFix && <div className="fix-block"><div className="fix-header"><span>Suggested fix</span><button onClick={copyFix} className="copy-button" aria-label="Copy suggested fix">{copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? 'Copied' : 'Copy'}</button></div><pre><code>{issue.suggestedFix}</code></pre></div>}
    <footer className="issue-footer"><span className="source-label">{(issue.sources ?? [issue.sourceTool ?? 'LLM']).map((source) => <span key={source} className="source-chip">{source}</span>)}</span>{issue.verified && <span className="verified-label" title={issue.verificationReason}><ShieldCheck size={13} />Verified</span>}{issue.verificationStatus === 'not_requested' && <span className="unverified-label">Not verified</span>}</footer>
  </article>;
}
