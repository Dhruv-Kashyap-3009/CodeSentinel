import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

const monacoTheme = (theme) => (theme === 'dark' ? 'vs-dark' : 'light');

export default function CodeEditor({ code, onChange, language, issues = [], selectedLine, onReview, theme = 'dark' }) {
  const editorRef = useRef(null); const monacoRef = useRef(null);
  // The wrapper only themes Monaco when it loads it from the CDN, so the current
  // theme is tracked here and applied on mount and on every switch.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const codeRef = useRef(code);
  codeRef.current = code;

  function configure(editor, monaco) {
    editorRef.current = editor; monacoRef.current = monaco;
    monaco.editor.setTheme(monacoTheme(themeRef.current));
    // A saved review can arrive before Monaco finishes mounting, so the latest
    // source is pushed into the fresh model here as well.
    if (editor.getValue() !== codeRef.current) editor.setValue(codeRef.current);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onReview);
  }
  useEffect(() => {
    monacoRef.current?.editor.setTheme(monacoTheme(theme));
  }, [theme]);
  // Synced on the next frame so the wrapper's own value/language effects have
  // already run when we write the model (they can otherwise overwrite it).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const model = editorRef.current?.getModel();
      if (!model || model.getValue() === code) return;
      model.setValue(code);
      // A programmatic replace can leave the previous measurement in place.
      editorRef.current?.layout();
    });
    return () => cancelAnimationFrame(frame);
  }, [code, language]);
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel(); if (!model) return;
    const markers = issues.filter((issue) => Number.isInteger(issue.line) && issue.line > 0 && issue.line <= model.getLineCount()).map((issue) => ({
      startLineNumber: issue.line, startColumn: 1, endLineNumber: issue.line, endColumn: model.getLineMaxColumn(issue.line),
      message: issue.explanation ?? issue.message, severity: issue.severity === 'high' ? 8 : issue.severity === 'medium' ? 4 : 2,
      source: issue.sources?.join(', ') ?? issue.sourceTool,
    }));
    monacoRef.current.editor.setModelMarkers(model, 'codesentinel', markers);
  }, [issues, code]);
  useEffect(() => {
    if (!selectedLine || !editorRef.current) return;
    editorRef.current.revealLineInCenter(selectedLine); editorRef.current.setPosition({ lineNumber: selectedLine, column: 1 });
    editorRef.current.focus();
  }, [selectedLine]);
  return <div className="monaco-wrap"><Editor height="100%" language={language} value={code} onChange={(value) => onChange(value ?? '')} onMount={configure}
    theme={monacoTheme(theme)} options={{ minimap: { enabled: false }, fontSize: 13, lineHeight: 23, fontFamily: 'DM Mono, Consolas, monospace', scrollBeyondLastLine: false, automaticLayout: true, padding: { top: 18, bottom: 14 }, wordWrap: 'on', tabSize: 2, renderLineHighlight: 'gutter', overviewRulerBorder: false }} /></div>;
}
