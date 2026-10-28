import { ArrowUpRight, Braces, Check, ChevronDown, CircleStop, Code2, Eraser, FileCode2, LoaderCircle, Play, Sparkles } from 'lucide-react';
import LanguageSelector from './LanguageSelector.jsx';

export default function EditorToolbar({ language, setLanguage, filename, setFilename, loading, code, onSample, onClear, onReview, onCancel }) {
  return <div className="editor-toolbar"><div className="toolbar-controls"><LanguageSelector value={language} onChange={setLanguage} /><label className="control-group filename-control"><span>FILENAME <small>OPTIONAL</small></span><div className="filename-input"><FileCode2 size={14} /><input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="e.g. app.js" aria-label="Optional filename" /></div></label></div>
    <div className="toolbar-actions"><button className="quiet-button" onClick={onSample} title="Load a deliberately buggy sample"><Sparkles size={15} /> <span>Sample</span></button><button className="quiet-button" onClick={onClear} disabled={!code && !loading} title="Clear source"><Eraser size={15} /><span>Clear</span></button><span className="toolbar-divider" />{loading ? <button className="review-button cancel-button" onClick={onCancel}><CircleStop size={16} /> Cancel</button> : <button className="review-button" disabled={!code.trim()} onClick={onReview}><span>Review code</span><Play size={14} fill="currentColor" /></button>}</div>
  </div>;
}
