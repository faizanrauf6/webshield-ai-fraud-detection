export type Fixture = 'benign' | 'phishing' | 'investment';
export type RiskCategory =
  'inconclusive' | 'low_observed_risk' | 'suspicious' | 'high_risk' | 'confirmed_malicious';
export interface Check {
  name: string;
  status: 'completed' | 'unavailable' | 'skipped' | 'failed';
  source: string;
  observedAt: string | null;
  detail: string;
}
export interface Signal {
  code: string;
  label: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  evidence: string;
  source: string;
  confidence: 'observation' | 'heuristic' | 'verified';
  observedAt: string;
}
export interface CryptoAddress {
  address: string;
  chain: string;
  validation: string;
}
export interface ModelPrediction {
  probability: number;
  threshold: number;
  modelVersion: string;
  featureVersion: string;
  scope: 'phishing';
  observedAt: string;
}
export interface ProviderEvidence {
  status: 'completed' | 'unavailable' | 'expired';
  reportedMalicious: boolean;
  source: string;
  checkedAt: string;
  expiresAt?: string;
  detail: string;
}
export interface ContentObservation {
  url: string;
  finalUrl: string;
  observedAt: string;
  title: string;
  text: string;
  forms: { action: string; hasPassword: boolean }[];
  linkDomains: string[];
  iframeCount: number;
  redirects: string[];
}
export interface DomainObservation {
  hostname: string;
  addresses: string[];
  observedAt: string;
  rdapStatus: 'completed' | 'unavailable';
  registeredAt: string | null;
  ageDays: number | null;
}
export interface Analysis {
  model?: ModelPrediction;
  providers?: ProviderEvidence[];
  category: RiskCategory;
  numericScore: number | null;
  providerExpiresAt?: string;
  providerSource?: string;
  screeningCategory?: RiskCategory;
  screeningSummary?: string;
  content?: Omit<ContentObservation, 'text'>;
  domain?: DomainObservation;
  summary: string;
  demo: boolean;
  signals: Signal[];
  checks: Check[];
  features: Record<string, number>;
  limitations: string[];
  crypto: { detected: boolean; addresses: CryptoAddress[]; claims: string[] };
}
export interface ScanReport {
  providers?: ProviderEvidence[];
  scan_id: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  submitted_url: string;
  normalized_url: string;
  hostname: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  fixture: Fixture | null;
  assessment: {
    category: RiskCategory;
    numeric_score: number | null;
    score_kind: 'unavailable' | 'model_probability';
    model_version: string | null;
    model_probability?: number;
    model_threshold?: number;
    model_scope?: string;
    summary: string;
    is_verified_malicious: boolean;
  };
  checks: Check[];
  signals: Signal[];
  features: Record<string, number>;
  limitations: string[];
  crypto: Analysis['crypto'];
  content?: Analysis['content'];
  domain?: DomainObservation;
  provider_source?: string;
  demo: boolean;
}
export interface HistoryResponse {
  items: ScanReport[];
  next_cursor: string | null;
  total: number;
}
export const FIXTURES: Record<
  Fixture,
  { url: string; label: string; description: string; text: string; formDestination?: string }
> = {
  benign: {
    url: 'https://store-demo.example/',
    label: 'Storefront',
    description: 'Ordinary retail content',
    text: 'Welcome to the sample bookshop. Browse books, read our shipping policy and contact our support team.',
  },
  phishing: {
    url: 'https://login-demo.example/',
    label: 'Phishing pattern',
    description: 'A mismatched credential form',
    text: 'Verify your account immediately. Enter your password to prevent account suspension.',
    formDestination: 'https://collector-demo.example/submit',
  },
  investment: {
    url: 'https://investment-demo.example/',
    label: 'Crypto investment',
    description: 'Unrealistic return claims',
    text: 'Crypto investment platform. Guaranteed returns of 30% daily. Double your deposit. Send Bitcoin to 1BoatSLRHtKNngkdXEeobR76b53LETtpyT or EVM funds to 0x52908400098527886E0F7030069857D2E4169EE7.',
  },
};
