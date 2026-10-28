import { BadgeCheck, CheckCheck } from 'lucide-react';
import IssueCard from './IssueCard.jsx';
import SummaryBar from './SummaryBar.jsx';
import AnalyzerWarnings from './AnalyzerWarnings.jsx';
import EmptyState from '../common/EmptyState.jsx';
import LoadingState from '../common/LoadingState.jsx';
import ErrorState from '../common/ErrorState.jsx';

export default function ResultsPanel({ report, loading, error, retry, onIssueClick, selectedLine, hasCode }) {
  return <section className="results-panel" aria-label="Review results"><SummaryBar report={report} loading={loading} /><div className="results-scroll"><AnalyzerWarnings warnings={report?.warnings} />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={retry} /> : !report ? <EmptyState title={hasCode ? 'Ready when you are' : 'A second set of eyes, on device'} description={hasCode ? 'Run a review to see actionable findings with their original source lines.' : 'Paste code into the editor or load a sample. The model and source stay local.'} /> : report.issues.length === 0 ? <div className="all-clear"><span className="all-clear-icon"><CheckCheck size={23} /></span><span className="clear-kicker">REVIEW COMPLETE</span><h3>No issues found</h3><p>No actionable problems surfaced in this pass. Static analysis and AI review can still miss defects.</p></div> : <div className="issues-list">{report.issues.map((issue, index) => <IssueCard key={`${issue.line}-${issue.category}-${index}`} issue={issue} index={index} selected={issue.line === selectedLine} onClick={onIssueClick} />)}</div>}
    {report && report.issues.length > 0 && <div className="review-disclaimer"><BadgeCheck size={13} /><span>Suggestions are advisory. Verify before applying changes.</span></div>}
  </div></section>;
}
