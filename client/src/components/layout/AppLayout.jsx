import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Braces, ChevronRight, Clock3, Command, Moon, Sun, Waves } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';

const navigation = [
  { to: '/', label: 'Review workspace', icon: Braces, end: true },
  { to: '/history', label: 'Review history', icon: Clock3 },
  { to: '/stats', label: 'Insights', icon: Activity },
];
export default function AppLayout() {
  const { theme, toggleTheme } = useTheme();
  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink className="brand" to="/" aria-label="CodeSentinel home">
        <span className="brand-symbol"><Waves size={20} strokeWidth={2.2} /></span>
        <span className="brand-name">code<span>sentinel</span></span>
      </NavLink>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{to === '/' && <ChevronRight className="nav-chevron" size={14} />}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="model-card"><span className="status-light" /><div><strong>Local model</strong><span>Ollama · on device</span></div><span className="model-dots">···</span></div>
        <div className="sidebar-footer">
          <span className="version-label"><span className="brand-dot" />All systems local</span>
          <button className="icon-button theme-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Change theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
        </div>
      </div>
    </aside>
    <main className="main-content"><Outlet /></main>
    <div className="mobile-brand"><NavLink to="/" className="brand"><span className="brand-symbol"><Waves size={19} /></span><span className="brand-name">code<span>sentinel</span></span></NavLink><button className="icon-button" onClick={toggleTheme} aria-label="Change theme">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></div>
    <div className="keyboard-hint"><Command size={12} /> <span>local-first code review</span></div>
  </div>;
}
