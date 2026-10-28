import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorState({ message, onRetry }) { return <div className="error-state"><span className="error-icon"><AlertTriangle size={19} /></span><h3>Review couldn’t finish</h3><p>{message}</p>{onRetry && <button className="quiet-button" onClick={onRetry}><RotateCcw size={14} />Try again</button>}</div>; }
