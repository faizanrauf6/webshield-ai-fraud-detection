'use client';
import { AlertCircle, ArrowUpRight, ChevronRight, Clock3, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import type { ScanReport } from '@webshield/core';
import { categoryLabel, dateTime } from '../lib/api';
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div role="alert" className="error-notice">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function HistoryRows({ items }: { items: ScanReport[] }) {
  return (
    <>
      {items.map((row) => (
        <tr key={row.scan_id}>
          <td>
            <div className="site-cell">
              <span className={`site-avatar ${row.demo ? 'demo-avatar' : ''}`}>
                {row.demo ? <FlaskConical size={16} /> : row.hostname.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{row.hostname}</strong>
                <small className="url-truncate">
                  {new URL(row.normalized_url).pathname}
                  {row.demo ? ' · Synthetic demo' : ''}
                </small>
              </div>
            </div>
          </td>
          <td>
            <Badge tone={row.assessment.is_verified_malicious ? 'danger' : 'neutral'}>
              {categoryLabel(row.assessment.category)}
            </Badge>
          </td>
          <td>
            <span className={`processing-status ${row.status}`}>
              <i />
              {row.status}
            </span>
          </td>
          <td className="table-date">{dateTime(row.created_at)}</td>
          <td>
            <Link className="table-action" href={`/scan/${row.scan_id}`} aria-label="View report">
              <ArrowUpRight size={18} />
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}
export function EmptyHistory() {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Clock3 size={24} />
      </span>
      <strong>Your first scan starts here</strong>
      <p>Analyze a website to build your evidence history.</p>
      <Link href="/">
        Analyze a website <ChevronRight size={14} />
      </Link>
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
