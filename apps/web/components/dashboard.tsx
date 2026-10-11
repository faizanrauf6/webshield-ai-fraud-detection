'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Fingerprint,
  FlaskConical,
  Globe2,
  Info,
  Link2,
  LockKeyhole,
  ScanLine,
  Shield,
  ShieldCheck,
  Sparkles,
  Wallet,
  Waves,
} from 'lucide-react';
import { FIXTURES, type Fixture, type HistoryResponse } from '@webshield/core';
import { api, type Providers } from '../lib/api';
import { EmptyHistory, ErrorNotice, HistoryRows } from './shared';
export function Dashboard() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [modelAvailable, setModelAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .model()
      .then((result) => {
        if (active) setModelAvailable(result.available);
      })
      .catch(() => {});
    api
      .providers()
      .then((result) => {
        if (active) setProviders(result);
      })
      .catch(() => {});
    api
      .history()
      .then((r) => {
        if (active) setHistory(r);
      })
      .catch(() => {
        if (active) setHistoryError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function scan(value: string, fixture?: Fixture) {
    setError('');
    setBusy(true);
    try {
      const result = await api.create(value, fixture);
      router.push(`/scan/${result.scan_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan could not start.');
      setBusy(false);
    }
  }
  return (
    <div className="dashboard page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="tiny-dot" /> WEBSITE RISK INTELLIGENCE
          </p>
          <h1>A second opinion for every link.</h1>
          <p>Look beyond appearances. Understand the evidence before you trust a website.</p>
        </div>
        <span className="offline-pill">
          <LockKeyhole size={13} /> Privacy-conscious by default
        </span>
      </div>
      <section className="scan-card" aria-label="Website scanner">
        <div className="scan-card-main">
          <span className="soft-label">
            <ScanLine size={14} /> Start an investigation
          </span>
          <h2>
            Good design can hide
            <br />
            bad intentions.
          </h2>
          <p className="scan-description">
            Check a URL for warning signs, explore the evidence,
            <br className="desktop-break" /> and understand what we can — and can’t — tell you.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void scan(url);
            }}
          >
            <label className="sr-only" htmlFor="website-url">
              Website URL
            </label>
            <div className="url-input-wrap">
              <Link2 size={20} />
              <input
                id="website-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://website-you-want-to-check.com"
                required
                maxLength={4096}
                autoComplete="url"
                spellCheck={false}
              />
              <button disabled={busy} className="primary-button" type="submit">
                {busy ? 'Starting scan…' : 'Analyze website'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
          {error && <ErrorNotice message={error} />}
          <div className="scan-fineprint">
            <ShieldCheck size={14} />
            <span>
              {providers?.content_scanning
                ? 'Live page checks use an isolated scanner. No wallet connection required.'
                : 'Live page checks are disabled. No wallet connection required.'}
            </span>
          </div>
        </div>
        <div className="scan-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-dot dot-one" />
          <div className="orbit-dot dot-two" />
          <div className="shield-slab">
            <Shield className="big-shield" strokeWidth={1} />
            <Fingerprint className="fingerprint" strokeWidth={1.3} />
          </div>
          <div className="art-chip chip-one">
            <span>
              <Check size={12} />
            </span>{' '}
            Evidence, explained
          </div>
          <div className="art-chip chip-two">
            <LockKeyhole size={13} /> Trust is earned
          </div>
          <span className="art-coordinates">OBSERVE · ANALYZE · UNDERSTAND</span>
        </div>
      </section>
      <div className="demo-row">
        <span>
          <FlaskConical size={15} /> Take a test drive
        </span>
        <div>
          {(Object.entries(FIXTURES) as [Fixture, (typeof FIXTURES)[Fixture]][]).map(
            ([key, fixture]) => (
              <button key={key} disabled={busy} onClick={() => void scan(fixture.url, key)}>
                {fixture.label}
                <ArrowUpRight size={13} />
              </button>
            ),
          )}
        </div>
        <small>Synthetic scenarios · no real websites</small>
      </div>
      <section className="capabilities" aria-label="Analysis capabilities">
        <div className="capability">
          <span className="capability-icon green">
            <Globe2 size={19} />
          </span>
          <div>
            <span>URL & domain structure</span>
            <strong>Lexical analysis</strong>
          </div>
          <span className="capability-status active-status">Active</span>
        </div>
        <div className="capability">
          <span className="capability-icon blue">
            <ShieldCheck size={19} />
          </span>
          <div>
            <span>Known threat reports</span>
            <strong>Provider intelligence</strong>
          </div>
          <span className="capability-status">
            {providers?.providers.some((p) => p.enabled && /OpenPhish|Safe Browsing/.test(p.name))
              ? 'Enabled'
              : 'Optional'}
          </span>
        </div>
        <div className="capability">
          <span className="capability-icon purple">
            <Wallet size={19} />
          </span>
          <div>
            <span>Addresses & return claims</span>
            <strong>Crypto indicators</strong>
          </div>
          <span className="capability-status">
            {providers?.content_scanning ? 'Live checks' : 'Demo'}
          </span>
        </div>
        <div className="capability">
          <span className="capability-icon orange">
            <Waves size={19} />
          </span>
          <div>
            <span>Research pipeline</span>
            <strong>Machine learning</strong>
          </div>
          <span className="capability-status">{modelAvailable ? 'Installed' : 'Undeployed'}</span>
        </div>
      </section>
      <div className="dashboard-columns">
        <section className="panel recent-panel">
          <div className="panel-header">
            <div>
              <h2>
                Recent investigations <span className="count-chip">{history?.total ?? '—'}</span>
              </h2>
              <p>A traceable record of what you checked.</p>
            </div>
            <Link href="/history" className="subtle-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {historyError ? (
            <div className="panel-pad">
              <ErrorNotice message="Scan history is unavailable. Check that the API is running." />
            </div>
          ) : !history ? (
            <div className="skeleton-table" aria-label="Loading history">
              <i />
              <i />
              <i />
            </div>
          ) : history.items.length ? (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
              <table aria-label="Recent investigations">
                <thead>
                  <tr>
                    <th>Website</th>
                    <th>Assessment</th>
                    <th>Status</th>
                    <th>Scanned at · PKT</th>
                    <th>
                      <span className="sr-only">Report</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <HistoryRows items={history.items.slice(0, 5)} />
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyHistory />
          )}
        </section>
        <aside className="understand-card">
          <span className="understand-icon">
            <Sparkles size={20} />
          </span>
          <p className="eyebrow">A HEALTHY DOSE OF SKEPTICISM</p>
          <h2>
            A padlock isn’t
            <br />a promise.
          </h2>
          <p>HTTPS protects a connection. It doesn’t verify the business behind a website.</p>
          <div className="understand-divider" />
          <Link href="/research">
            Learn how our analysis works <ChevronRight size={16} />
          </Link>
        </aside>
      </div>
      <div className="honesty-note">
        <Info size={17} />
        <p>
          <strong>Useful signals. Honest limitations.</strong> WebShield provides evidence to
          support your judgment. Missing reports don’t mean safe, and warning signs don’t prove
          fraud.
        </p>
        <Link href="/research" aria-label="Read research limitations">
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </div>
  );
}
