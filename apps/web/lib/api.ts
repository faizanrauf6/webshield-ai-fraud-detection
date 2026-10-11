import type { Fixture, HistoryResponse, ScanReport } from '@webshield/core';
export type Providers = {
  content_scanning: boolean;
  providers: { name: string; configured: boolean; enabled: boolean; purpose: string }[];
  privacy: string;
};
export type ModelInfo = {
  available: boolean;
  message: string;
  feature_version: string;
  model_version: string | null;
  scope: string;
  threshold: number | null;
  metrics: Record<
    string,
    {
      per_class: Record<string, { precision: number; recall: number; f1: number; support: number }>;
      false_positive_rate: number;
    }
  > | null;
  evaluation: {
    protocol: string;
    selected_model: string;
    counts: { train: number; validation: number; test: number };
    provenance?: { name?: string; source?: string; license?: string };
  } | null;
};
async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    let message = 'The service could not complete this request.';
    try {
      const body = await response.json();
      message = Array.isArray(body.message) ? body.message.join(' ') : body.message || message;
    } catch {
      /* Keep a generic error when the response is not JSON. */
    }
    throw new Error(message);
  }
  return response.json();
}
export const api = {
  create: (url: string, fixture?: Fixture) =>
    call<{ scan_id: string; status: string }>('/scans', {
      method: 'POST',
      body: JSON.stringify({ url, ...(fixture ? { fixture } : {}) }),
    }),
  scan: (id: string, signal?: AbortSignal) =>
    call<ScanReport>(`/scans/${encodeURIComponent(id)}`, { signal }),
  history: (cursor?: string) =>
    call<HistoryResponse>(
      `/scans?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  providers: () => call<Providers>('/providers'),
  model: () => call<ModelInfo>('/model-info'),
  health: () => call<{ status: string }>('/health'),
};
export function dateTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
  }).format(new Date(value));
}
export const categoryLabel = (category: string) =>
  ({
    inconclusive: 'Inconclusive',
    low_observed_risk: 'Low observed risk',
    suspicious: 'Suspicious',
    high_risk: 'High risk',
    confirmed_malicious: 'Reported potential threat',
  })[category] || category;
