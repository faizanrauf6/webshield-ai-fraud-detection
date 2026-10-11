'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3, Search, SlidersHorizontal } from 'lucide-react';
import type { ScanReport } from '@webshield/core';
import { api } from '../lib/api';
import { EmptyHistory, ErrorNotice, HistoryRows } from './shared';
export function History() {
  const [items, setItems] = useState<ScanReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async (next?: string) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.history(next);
      setItems((prev) => (next ? [...prev, ...r.items] : r.items));
      setCursor(r.next_cursor);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'History unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = items.filter(
    (row) =>
      row.normalized_url.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || (filter === 'demo' ? row.demo : !row.demo)),
  );
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR INVESTIGATION LOG</p>
          <h1>Every check leaves a trail.</h1>
          <p>Revisit findings, compare evidence and keep your research traceable.</p>
        </div>
        <Link href="/" className="primary-button">
          New investigation <ArrowRight size={16} />
        </Link>
      </div>
      <div className="history-summary">
        <Clock3 size={20} />
        <strong>{total}</strong>
        <span>saved investigations in this local workspace</span>
      </div>
      <section className="panel">
        <div className="history-toolbar">
          <div className="search-input">
            <Search size={17} />
            <label htmlFor="history-search" className="sr-only">
              Search loaded scans
            </label>
            <input
              id="history-search"
              placeholder="Search loaded scans by URL…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-input">
            <SlidersHorizontal size={16} />
            <label htmlFor="history-filter" className="sr-only">
              Scan type
            </label>
            <select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All scans</option>
              <option value="submitted">Submitted URLs</option>
              <option value="demo">Synthetic demos</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="panel-pad">
            <ErrorNotice message={error} />
            <button className="secondary-button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}
        {visible.length ? (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
            <table aria-label="Scan history">
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
                <HistoryRows items={visible} />
              </tbody>
            </table>
          </div>
        ) : !loading && !error ? (
          items.length ? (
            <div className="empty-state">
              <strong>No matching loaded scans</strong>
              <p>Change your search or load more investigations.</p>
            </div>
          ) : (
            <EmptyHistory />
          )
        ) : null}
        {loading && (
          <p className="loading-text" role="status">
            Loading investigations…
          </p>
        )}
        <div className="history-pagination">
          <span>
            Showing {visible.length} of {total} saved scans
            {query ? ' · search applies to loaded rows' : ''}
          </span>
          {cursor && (
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              Load more <ArrowRight size={14} />
            </button>
          )}
        </div>
      </section>
      <p className="privacy-caption">
        History is shared by users of this local deployment. URLs may contain sensitive query
        parameters; remove secrets before submitting.
      </p>
    </div>
  );
}
