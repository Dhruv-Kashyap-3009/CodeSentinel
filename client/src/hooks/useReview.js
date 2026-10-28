import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

export function useReview() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(null);
  const lastPayload = useRef(null);
  const run = useCallback(async (payload) => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; lastPayload.current = payload;
    setLoading(true); setError('');
    try { const next = await api.review(payload, controller.signal); if (!controller.signal.aborted) setReport(next); }
    catch (reason) { if (reason.name !== 'AbortError') setError(reason.message); }
    finally { if (active.current === controller) { active.current = null; setLoading(false); } }
  }, []);
  const cancel = useCallback(() => { active.current?.abort(); active.current = null; setLoading(false); }, []);
  const retry = useCallback(() => lastPayload.current && run(lastPayload.current), [run]);
  const reset = useCallback(() => { cancel(); setReport(null); setError(''); }, [cancel]);
  useEffect(() => () => active.current?.abort(), []);
  return { report, setReport, loading, error, run, retry, cancel, reset };
}
