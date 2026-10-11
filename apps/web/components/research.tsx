'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Binary,
  BookOpen,
  ChartNoAxesCombined,
  CheckCheck,
  FlaskConical,
  GitCompareArrows,
  Layers3,
  LockKeyhole,
} from 'lucide-react';
import { api } from '../lib/api';
import { Badge, ErrorNotice } from './shared';
export function Research() {
  const [model, setModel] = useState<Awaited<ReturnType<typeof api.model>> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .model()
      .then(setModel)
      .catch((e) => setError(e.message));
  }, []);
  const steps = [
    {
      icon: Binary,
      title: 'Observe',
      text: 'Extract reproducible URL structure without visiting the target.',
    },
    {
      icon: Layers3,
      title: 'Combine',
      text: 'Keep local heuristics separate from independently sourced reports.',
    },
    {
      icon: ChartNoAxesCombined,
      title: 'Evaluate',
      text: 'Evaluate unseen domain groups; use temporal holdouts when observation dates exist.',
    },
    {
      icon: CheckCheck,
      title: 'Explain',
      text: 'Show provenance, missing checks and the limits of each conclusion.',
    },
  ];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RESEARCH LAB</p>
          <h1>Evidence before accuracy.</h1>
          <p>A reproducible experiment, transparent assumptions and room to be wrong.</p>
        </div>
        <span className="offline-pill">
          <FlaskConical size={14} /> Final-year project
        </span>
      </div>
      <section className="research-question">
        <div>
          <span className="soft-label">
            <BookOpen size={14} /> The question we’re investigating
          </span>
          <h2>
            Can combining signals help us identify
            <br className="desktop-break" /> websites we’ve never seen before?
          </h2>
          <p>
            Compare URL-only analysis with domain, content and threat intelligence at an acceptable
            false-positive rate. Improvement is a hypothesis to test, not a promised outcome.
          </p>
        </div>
        <span className="research-question-art" aria-hidden="true">
          <GitCompareArrows size={78} strokeWidth={1} />
        </span>
      </section>
      <div className="research-steps">
        {steps.map((step, i) => (
          <article key={step.title}>
            <span className="step-number">0{i + 1}</span>
            <step.icon size={23} />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
      {error && <ErrorNotice message={error} />}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Model comparison</h2>
            <p>Real-world held-out evaluation is required before any production accuracy claim.</p>
          </div>
          <Badge>{model?.available ? 'Model installed' : 'No deployed model'}</Badge>
        </div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
          <table aria-label="Model evaluation status">
            <thead>
              <tr>
                <th>Baseline</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1</th>
                <th>False-positive rate</th>
                <th>Real-world status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries({
                logistic_regression: 'Logistic regression',
                random_forest: 'Random forest',
                hist_gradient_boosting: 'Histogram gradient boosting',
              }).map(([key, name]) => {
                const metrics = model?.available ? model.metrics?.[key] : undefined;
                const positive = metrics?.per_class['1'];
                const percent = (n: number | undefined) =>
                  n == null ? '—' : `${(n * 100).toFixed(1)}%`;
                return (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td>{percent(positive?.precision)}</td>
                    <td>{percent(positive?.recall)}</td>
                    <td>{percent(positive?.f1)}</td>
                    <td>{percent(metrics?.false_positive_rate)}</td>
                    <td>
                      <Badge>
                        {metrics
                          ? model?.evaluation?.selected_model === key
                            ? 'Selected · benchmark'
                            : 'Benchmark evaluated'
                          : 'Not evaluated'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="table-footnote">
          <FlaskConical size={14} /> Synthetic smoke-test metrics validate pipeline execution only.
          They are deliberately excluded from this comparison.
        </p>
      </section>
      {model?.available && model.evaluation && (
        <section className="panel panel-pad">
          <h2>Installed experiment</h2>
          <p>
            Protocol: {model.evaluation.protocol} · Holdout:{' '}
            {model.evaluation.counts.test.toLocaleString()} records · Scope: {model.scope}
          </p>
          <p className="body-muted">{model.message}</p>
          <p className="body-muted">
            Dataset: {model.evaluation.provenance?.name || 'Documented local dataset'} · License:{' '}
            {model.evaluation.provenance?.license || 'See provenance'} · Version:{' '}
            {model.model_version}
          </p>
          <p className="body-muted">
            Benchmark observation dates are unavailable; these results do not establish temporal
            performance, hybrid improvement, or detection of deceptive stores and investment fraud.
          </p>
        </section>
      )}
      <div className="research-grid">
        <section className="panel panel-pad">
          <span className="eyebrow">EVALUATION DESIGN</span>
          <h2>Keep the test genuinely unseen.</h2>
          <ul className="research-list">
            <li>
              <CheckCheck size={17} />
              <div>
                <strong>Group by domain and campaign</strong>
                <p>Prevent variants of the same site from leaking between partitions.</p>
              </div>
            </li>
            <li>
              <CheckCheck size={17} />
              <div>
                <strong>Match the split to available evidence</strong>
                <p>
                  Use later time windows for dated data; label undated benchmark splits by domain
                  group.
                </p>
              </div>
            </li>
            <li>
              <CheckCheck size={17} />
              <div>
                <strong>Measure the cost of mistakes</strong>
                <p>Report false positives, precision, recall, PR-AUC and calibration.</p>
              </div>
            </li>
            <li>
              <CheckCheck size={17} />
              <div>
                <strong>Freeze before final evaluation</strong>
                <p>Never tune the model against the final holdout set.</p>
              </div>
            </li>
          </ul>
        </section>
        <section className="limitations-panel">
          <h3>
            <LockKeyhole size={18} /> What we cannot claim
          </h3>
          <ul>
            <li>
              No tool can identify every fraudulent website or guarantee a legitimate business.
            </li>
            <li>
              Popular domains are candidate examples, not automatically trustworthy training labels.
            </li>
            <li>
              Missing reports, valid HTTPS and old registration dates do not establish legitimacy.
            </li>
            <li>
              A model probability describes its dataset definition; it is not a guarantee about a
              website.
            </li>
            <li>
              Static HTML and domain checks depend on enabled integrations. Screenshot impersonation
              and on-chain analysis remain unavailable. Hybrid performance requires matched
              historical observations.
            </li>
          </ul>
        </section>
      </div>
      <section className="references">
        <h3>Methods & primary references</h3>
        <div>
          <a
            href="https://scikit-learn.org/stable/model_selection.html"
            target="_blank"
            rel="noreferrer"
          >
            scikit-learn · Model evaluation <ArrowUpRight size={14} />
          </a>
          <a href="https://developers.google.com/safe-browsing/" target="_blank" rel="noreferrer">
            Google Safe Browsing · URL intelligence <ArrowUpRight size={14} />
          </a>
          <a href="https://tranco-list.eu/" target="_blank" rel="noreferrer">
            Tranco · Candidate domain sampling <ArrowUpRight size={14} />
          </a>
        </div>
      </section>
    </div>
  );
}
