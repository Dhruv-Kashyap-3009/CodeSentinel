import { LoaderCircle, LockKeyhole } from 'lucide-react';

export default function LoadingState() { return <div className="loading-state"><LoaderCircle className="loading-spinner" size={27} /><h3>Reading the code</h3><p>Static checks and local model review are in progress.</p><span className="privacy-note"><LockKeyhole size={13} />Your source stays on this machine</span></div>; }
