import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, Braces, Clock3, Command, FileCode2, GitBranch, Sparkles, TerminalSquare } from 'lucide-react';
import { useReview } from '../hooks/useReview.js';
import { api } from '../services/api.js';
import { languages, samples } from '../utils/samples.js';
import { useTheme } from '../hooks/useTheme.js';
import CodeEditor from '../components/editor/CodeEditor.jsx';
import EditorToolbar from '../components/editor/EditorToolbar.jsx';
import ResultsPanel from '../components/review/ResultsPanel.jsx';

const starter = `// Paste code here or load a sample to get started\n\nasync function fetchAccount(accountId) {\n  const response = fetch('/api/accounts/' + accountId);\n  return response.json();\n}`;
export default function ReviewPage() {
  const { id } = useParams(); const navigate = useNavigate(); const { theme } = useTheme();
  const [code, setCode] = useState(starter); const [language, setLanguage] = useState('auto'); const [filename, setFilename] = useState(''); const [selectedLine, setSelectedLine] = useState(null);
  const review = useReview(); const editorLanguage = useMemo(() => languages.find((item) => item.id === language)?.monaco ?? 'javascript', [language]);
  const loadReview = useCallback(async (reviewId) => {
    try { const saved = await api.reviewById(reviewId); setCode(saved.code); setLanguage(saved.language); review.setReport({ ...saved.report, cached: true }); review.cancel(); }
    catch (error) { review.reset(); navigate('/', { replace: true, state: { error: error.message } }); }
  }, [navigate, review.cancel, review.reset, review.setReport]);
  useEffect(() => { if (id) loadReview(id); else { setCode(starter); setLanguage('auto'); review.reset(); } }, [id]);
  const run = useCallback(() => { if (!code.trim() || review.loading) return; setSelectedLine(null); review.run({ code, language: language === 'auto' ? undefined : language, filename: filename.trim() || undefined }); }, [code, filename, language, review]);
  useEffect(() => { function handleShortcut(event) { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); } } window.addEventListener('keydown', handleShortcut); return () => window.removeEventListener('keydown', handleShortcut); }, [run]);
  function loadSample() { const selected = language === 'auto' ? 'javascript' : language; setCode(samples[selected]); setFilename(`sample.${({ javascript: 'js', python: 'py', java: 'java', c: 'c', cpp: 'cpp', html: 'html', css: 'css', sql: 'sql' })[selected]}`); setSelectedLine(null); review.reset(); }
  function clearCode() { setCode(''); setSelectedLine(null); setFilename(''); review.reset(); if (id) navigate('/', { replace: true }); }
  const savedMode = Boolean(id && review.report);
  return <div className="review-page"><header className="page-header"><div className="page-heading"><div className="breadcrumb"><span>WORKSPACE</span><span className="breadcrumb-slash">/</span><strong>Code review</strong></div><h1>Review code<span className="heading-period">.</span></h1><p>Find the defects a quick scan might miss.</p></div><div className="header-meta"><span className="local-pill"><span className="status-light" /> LOCAL &amp; PRIVATE</span><Link to="/history" className="history-shortcut"><Clock3 size={15} />Recent reviews<ArrowRight size={14} /></Link></div></header>
    <div className="workspace-labels"><span><FileCode2 size={14} />SOURCE</span><span className="workspace-connector"><GitBranch size={13} />REVIEW OUTPUT</span></div>
    <div className="review-workspace"><section className="editor-panel" aria-label="Source editor"><EditorToolbar language={language} setLanguage={(value) => { setLanguage(value); if (review.report) review.reset(); }} filename={filename} setFilename={setFilename} loading={review.loading} code={code} onSample={loadSample} onClear={clearCode} onReview={run} onCancel={review.cancel} /><CodeEditor key={id ?? 'draft'} code={code} onChange={(value) => { setCode(value); if (review.report) review.reset(); }} language={editorLanguage} issues={review.report?.issues} selectedLine={selectedLine} onReview={run} theme={theme} /><div className="editor-status"><span><span className="status-light" />EDITOR READY</span><span>{code.split('\n').length} LINES <span className="status-dot-sep">·</span> {new TextEncoder().encode(code).length} BYTES</span></div></section>
      <ResultsPanel report={review.report} loading={review.loading} error={review.error} retry={review.retry} onIssueClick={setSelectedLine} selectedLine={selectedLine} hasCode={Boolean(code.trim())} />
    </div><footer className="review-footer"><span><Sparkles size={13} />No code leaves this workspace</span><span className="shortcut-caption"><Command size={12} /> + Enter to review</span></footer>
  </div>;
}
