'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  History,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { ThemeToggle } from './theme-toggle';
const links = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/history', label: 'Scan history', icon: History },
  { href: '/research', label: 'Research lab', icon: BookOpen },
  { href: '/settings', label: 'Configuration', icon: Settings2 },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    let alive = true;
    api
      .health()
      .then(() => {
        if (alive) setConnection('online');
      })
      .catch(() => {
        if (alive) setConnection('offline');
      });
    return () => {
      alive = false;
    };
  }, [path]);
  const title = path.startsWith('/scan/')
    ? 'Scan report'
    : links.find((l) => l.href === path)?.label || 'Workspace';
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="WebShield AI home">
          <span className="brand-icon">
            <ShieldCheck size={24} />
          </span>
          <span>
            webshield<span className="brand-ai">AI</span>
          </span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">W</span>
          <div>
            <strong>Research workspace</strong>
            <small>Local development</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${path === href || (href === '/' && path.startsWith('/scan/')) ? 'active' : ''}`}
              aria-current={path === href ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-note">
            <span className="little-spark">
              <Sparkles size={18} />
            </span>
            <strong>Built on evidence.</strong>
            <p>Understand the signals behind a website. Make a more informed decision.</p>
            <Link href="/research">
              Explore our approach <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link href="/settings" className="help-link">
            <CircleHelp size={17} /> Privacy & limitations
          </Link>
          <div className="profile">
            <span className="profile-avatar">R</span>
            <div>
              <strong>FYP researcher</strong>
              <small>Local workspace</small>
            </div>
            <span className="version">v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            <span className={`connection ${connection}`}>
              <i />
              {connection === 'online'
                ? 'API connected'
                : connection === 'offline'
                  ? 'API unavailable'
                  : 'Connecting'}
            </span>
            <span className="topbar-divider" />
            <span className="environment">FYP prototype</span>
            <span className="top-avatar">R</span>
          </div>
        </header>
        <main id="main-content" className="content">
          {children}
        </main>
        <footer className="footer">
          <span>
            <ShieldCheck size={14} /> WebShield AI · Research prototype
          </span>
          <span>Evidence informs. No scan guarantees safety.</span>
        </footer>
      </div>
    </div>
  );
}
