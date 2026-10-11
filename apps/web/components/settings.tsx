'use client';
import { useEffect, useState } from 'react';
import { Database, Info, LockKeyhole, PlugZap, ShieldCheck, Terminal } from 'lucide-react';
import { api, type Providers } from '../lib/api';
import { Badge, ErrorNotice } from './shared';
export function Settings() {
  const [data, setData] = useState<Providers | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .providers()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONFIGURATION & PRIVACY</p>
          <h1>Know what is connected.</h1>
          <p>See the tools behind each investigation and where your evidence comes from.</p>
        </div>
        <span className="offline-pill">
          <LockKeyhole size={14} /> Server-managed credentials
        </span>
      </div>
      {error && <ErrorNotice message={error} />}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>
              <PlugZap size={18} /> Intelligence providers
            </h2>
            <p>Availability is configuration status, not a successful provider health check.</p>
          </div>
          <Badge>Read only</Badge>
        </div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
          <table aria-label="Provider configuration">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Configured</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.providers.map((p) => (
                <tr key={p.name}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.purpose}</td>
                  <td>{p.configured ? 'Yes' : 'No'}</td>
                  <td>
                    <Badge tone={p.enabled ? 'green' : 'neutral'}>
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data && !error && (
          <p role="status" className="loading-text">
            Loading provider configuration…
          </p>
        )}
      </section>
      <div className="research-grid">
        <section className="panel panel-pad">
          <span className="settings-icon">
            <Database size={22} />
          </span>
          <h2>Your data stays in this deployment.</h2>
          <p className="body-muted">
            {data?.privacy ||
              'Submitted URLs and scan reports are stored in the local PostgreSQL database.'}
          </p>
          <div className="info-inline">
            <Info size={17} />
            <p>
              Remove tokens, personal information and secrets from URLs before scanning. History is
              shared by users of this deployment.
            </p>
          </div>
          <p className="body-muted">
            There are no user accounts or automatic retention limits in this prototype. Do not
            expose it as a public multi-user service without access controls.
          </p>
        </section>
        <section className="panel panel-pad">
          <span className="settings-icon">
            <ShieldCheck size={22} />
          </span>
          <h2>
            {data
              ? `Live page scanning is ${data.content_scanning ? 'enabled' : 'disabled'}.`
              : 'Checking live page configuration…'}
          </h2>
          <p className="body-muted">
            {data?.content_scanning
              ? 'A separate isolated worker inspects bounded static HTML, forms and cryptocurrency indicators. JavaScript is not executed and forms are never submitted.'
              : 'Live content fetching is off. Content and cryptocurrency demonstrations use repository-owned synthetic fixtures.'}
          </p>
          <div className="info-inline">
            <LockKeyhole size={17} />
            <p>
              Public-address validation, pinned connections, redirect checks and independent network
              restrictions protect the scanner from internal network targets.
            </p>
          </div>
          <p className="body-muted">
            No wallets are connected, forms submitted or transactions signed.
          </p>
        </section>
      </div>
      <section className="config-note">
        <Terminal size={20} />
        <div>
          <h3>Configure integrations on the server</h3>
          <p>
            Use the documented environment variables to enable licensed external URL lookups. API
            keys never appear in this interface or browser JavaScript. Restart the API after
            configuration changes.
          </p>
        </div>
      </section>
    </div>
  );
}
