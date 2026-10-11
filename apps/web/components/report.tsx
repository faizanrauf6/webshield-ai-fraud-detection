'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Download,
  FlaskConical,
  Globe2,
  Info,
  LoaderCircle,
  RotateCw,
  ShieldAlert,
  ShieldQuestion,
  Wallet,
} from 'lucide-react';
import type { ScanReport } from '@webshield/core';
import { api, categoryLabel, dateTime } from '../lib/api';
import { Badge, ErrorNotice, SectionHeading } from './shared';
const terminal = ['completed', 'partial', 'failed'];
export function Report({ id }: { id: string }) {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const result = await api.scan(id, controller.signal);
        if (!alive) return;
        setReport(result);
        setError('');
        if (!terminal.includes(result.status)) timer = setTimeout(poll, 1200);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Report is unavailable.');
      }
    }
    void poll();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [id]);
  async function retry() {
    if (!report) return;
    setRetrying(true);
    try {
      const result = await api.create(report.normalized_url, report.fixture || undefined);
      router.push(`/scan/${result.scan_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed.');
      setRetrying(false);
    }
  }
  if (error && !report)
    return (
      <div className="page-enter">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} /> Back to overview
        </Link>
        <h1>Report unavailable</h1>
        <ErrorNotice message={error} />
      </div>
    );
  if (!report)
    return (
      <div className="report-loading" role="status">
        <LoaderCircle size={30} className="spin" />
        <h1>Opening your investigation</h1>
        <p>Loading the saved scan and its evidence.</p>
      </div>
    );
  const done = terminal.includes(report.status);
  const completed = report.checks.filter((c) => c.status === 'completed').length;
  const warnings = report.signals.filter((s) => s.severity === 'high' || s.severity === 'medium');
  return (
    <div className="page-enter">
      <Link href="/" className="back-link">
        <ArrowLeft size={15} /> Back to overview
      </Link>
      <div className="page-heading report-heading">
        <div>
          <p className="eyebrow">INVESTIGATION REPORT</p>
          <h1 className="report-host">{report.hostname}</h1>
          <p className="report-url">{report.normalized_url}</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => void retry()} disabled={retrying}>
            <RotateCw size={15} />
            {retrying ? 'Starting…' : 'Scan again'}
          </button>
          <a className="primary-button" href={`/api/v1/scans/${report.scan_id}/export`} download>
            <Download size={15} /> Export JSON
          </a>
        </div>
      </div>
      {error && <ErrorNotice message={error} />}
      {report.demo && (
        <div className="demo-notice">
          <FlaskConical size={18} />
          <div>
            <strong>Synthetic demo</strong>
            <p>
              This report uses repository-owned sample content. It does not assess a real website.
            </p>
          </div>
        </div>
      )}
      {!done ? (
        <section className="panel processing-card" role="status">
          <LoaderCircle className="spin" size={24} />
          <div>
            <h2>
              {report.status === 'queued'
                ? 'Your investigation is queued'
                : 'Examining available evidence'}
            </h2>
            <p>You can leave this page. Your scan is saved in history.</p>
          </div>
          <Badge>{report.status}</Badge>
        </section>
      ) : (
        <section
          className={`assessment-card ${report.assessment.is_verified_malicious || report.assessment.category === 'suspicious' ? 'assessment-danger' : ''}`}
        >
          <div className="assessment-symbol">
            {report.assessment.is_verified_malicious ? (
              <ShieldAlert size={38} />
            ) : (
              <ShieldQuestion size={38} />
            )}
          </div>
          <div className="assessment-copy">
            <div className="assessment-kicker">
              <span>OVERALL ASSESSMENT</span>
              <Badge tone={report.status === 'failed' ? 'danger' : 'neutral'}>
                {report.status === 'partial' ? 'Partial coverage' : report.status}
              </Badge>
            </div>
            <h2>
              {report.status === 'failed'
                ? 'Assessment unavailable'
                : categoryLabel(report.assessment.category)}
            </h2>
            <p>{report.assessment.summary}</p>
          </div>
          <div className="score-placeholder">
            <CircleHelp size={24} />
            <strong>
              {report.assessment.model_probability != null
                ? `${(report.assessment.model_probability * 100).toFixed(1)}%`
                : report.assessment.category === 'suspicious'
                  ? 'Rule-based warning'
                  : 'No validated risk score'}
            </strong>
            <span>
              {report.assessment.model_probability != null
                ? 'Phishing model estimate'
                : report.assessment.category === 'suspicious'
                  ? 'Review the observed warning signs below.'
                  : 'Review the available evidence below.'}
            </span>
          </div>
        </section>
      )}
      {report.assessment.is_verified_malicious &&
        report.provider_source !== 'OpenPhish Community Feed' && (
          <p className="provider-attribution">
            <a
              href="https://developers.google.com/safe-browsing/v4/support"
              target="_blank"
              rel="noreferrer"
            >
              Advisory provided by Google
            </a>
            . Reports may contain false positives or miss threats.{' '}
            <a href="https://www.antiphishing.org/" target="_blank" rel="noreferrer">
              Learn about phishing
            </a>
            .
          </p>
        )}
      {report.assessment.is_verified_malicious &&
        report.provider_source === 'OpenPhish Community Feed' && (
          <p className="provider-attribution">
            Phishing report provided by{' '}
            <a href="https://openphish.com/" target="_blank" rel="noreferrer">
              OpenPhish Community Feed
            </a>
            . Limited coverage, refreshed every 12 hours. A missing match does not prove safety.
          </p>
        )}
      {report.status === 'failed' && (
        <ErrorNotice
          message={`Processing failed (${report.error || 'unknown error'}). Try a new scan; this report does not establish legitimacy.`}
        />
      )}
      <div className="report-facts">
        <span>
          <Globe2 size={15} />
          {completed} of {report.checks.length || '—'} checks completed
        </span>
        <span>
          <ShieldAlert size={15} />
          {warnings.length} warning {warnings.length === 1 ? 'signal' : 'signals'}
        </span>
        <span>Submitted {dateTime(report.created_at)} PKT</span>
        <span>
          {report.completed_at
            ? `Finished ${dateTime(report.completed_at)} PKT`
            : 'Processing pending'}
        </span>
      </div>
      {report.content && (
        <section className="panel panel-pad">
          <h2>Observed page</h2>
          <p>{report.content.title || 'No page title'}</p>
          <p className="body-muted">Final URL: {report.content.finalUrl}</p>
          <p className="body-muted">
            {report.content.forms.length} forms · {report.content.redirects.length} redirects ·
            Static HTML only
          </p>
        </section>
      )}
      {report.assessment.model_version && (
        <section className="panel panel-pad">
          <h2>Model context</h2>
          <p>
            Scope: {report.assessment.model_scope || 'phishing'} · Warning threshold:{' '}
            {((report.assessment.model_threshold || 0) * 100).toFixed(1)}%
          </p>
          <p className="body-muted">
            Version: {report.assessment.model_version}. This estimate reflects a historical phishing
            benchmark and does not verify business legitimacy or investment safety.
          </p>
        </section>
      )}
      {Boolean(report.providers?.length) && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Threat provider freshness</h2>
              <p>
                Historical reports retain their source and expiry. Expired observations require a
                rescan.
              </p>
            </div>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable provider table"
          >
            <table aria-label="Threat provider freshness">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Observed · PKT</th>
                  <th>Expires · PKT</th>
                </tr>
              </thead>
              <tbody>
                {report.providers?.map((p) => (
                  <tr key={p.source}>
                    <td>{p.source}</td>
                    <td>{p.status}</td>
                    <td>{dateTime(p.checkedAt)}</td>
                    <td>{p.expiresAt ? dateTime(p.expiresAt) : 'Not supplied'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>The evidence, in plain sight</h2>
            <p>Every check includes its source, availability and observation time.</p>
          </div>
          <span className="mini-label">{report.checks.length} checks</span>
        </div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
          <table className="evidence-table" aria-label="Scan evidence">
            <thead>
              <tr>
                <th>Check & observation</th>
                <th>Status</th>
                <th>Source</th>
                <th>Observed · PKT</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((check) => (
                <tr key={check.name}>
                  <td>
                    <strong>{check.name}</strong>
                    <p>{check.detail}</p>
                  </td>
                  <td>
                    <Badge
                      tone={
                        check.status === 'completed'
                          ? 'green'
                          : check.status === 'failed'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {check.status}
                    </Badge>
                  </td>
                  <td>{check.source}</td>
                  <td className="table-date">
                    {check.observedAt ? dateTime(check.observedAt) : 'Not observed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.checks.length && (
            <div className="empty-state">
              <p>Evidence will appear after processing.</p>
            </div>
          )}
        </div>
      </section>
      <section className="signals-section">
        <SectionHeading
          eyebrow="OBSERVATIONS & HEURISTICS"
          title="What deserves a closer look"
          description="A warning sign is a reason to investigate, not an automatic verdict."
        />
        {report.signals.length ? (
          <div className="signal-grid">
            {report.signals.map((signal) => (
              <article className={`signal-card severity-${signal.severity}`} key={signal.code}>
                <div className="signal-top">
                  <span className="signal-icon">
                    {signal.severity === 'info' ? <Info size={18} /> : <ShieldAlert size={18} />}
                  </span>
                  <span className="severity-label">{signal.severity}</span>
                </div>
                <h3>{signal.label}</h3>
                <p>{signal.evidence}</p>
                <div className="signal-provenance">
                  <span>{signal.source}</span>
                  <span>{signal.confidence}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel no-signals">
            <CheckCheck size={23} />
            <div>
              <strong>No configured heuristics triggered</strong>
              <p>This is a limited observation and does not establish safety.</p>
            </div>
          </div>
        )}
      </section>
      {report.crypto.detected && (
        <section className="panel crypto-panel">
          <div className="panel-header">
            <div>
              <h2>
                <Wallet size={19} /> Cryptocurrency indicators
              </h2>
              <p>
                Address candidates and claims from available content. No transactions were
                performed.
              </p>
            </div>
            <Badge>Chain context unverified</Badge>
          </div>
          {report.crypto.claims.length > 0 && (
            <div className="claim-row">
              {report.crypto.claims.map((c) => (
                <span key={c}>“{c}”</span>
              ))}
            </div>
          )}
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
            <table aria-label="Cryptocurrency address candidates">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Possible network</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {report.crypto.addresses.map((address) => (
                  <tr key={address.address}>
                    <td>
                      <code className="wallet-address">{address.address}</code>
                    </td>
                    <td>{address.chain}</td>
                    <td>{address.validation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footnote">
            <Info size={14} /> Address presence does not imply abuse. No external address reports or
            on-chain activity were checked.
          </div>
        </section>
      )}
      <div className="report-bottom">
        <section className="limitations-panel">
          <h3>
            <Info size={18} /> Read this assessment with context
          </h3>
          <ul>
            {report.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        <section className="panel next-step">
          <span className="eyebrow">BEFORE YOU PROCEED</span>
          <h3>Verify independently.</h3>
          <p>
            Find the official domain through a trusted source. Be cautious with deposits, account
            credentials and wallet approvals.
          </p>
          <Link href="/research">
            Understand the methodology <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <details className="technical-details">
        <summary>
          Technical observations <ChevronDown size={16} />
        </summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
          <table aria-label="Lexical feature values">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Observed value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.features).map(([name, value]) => (
                <tr key={name}>
                  <td>
                    <code>{name}</code>
                  </td>
                  <td>{Number.isInteger(value) ? value : value.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-footnote">
          Scan ID: {report.scan_id} · Model: {report.assessment.model_version || 'unavailable'}
        </p>
      </details>
    </div>
  );
}
