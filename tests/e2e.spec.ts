import { test, expect } from '@playwright/test';
test('submit URL, inspect truthful report, export and find history', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A second opinion for every link.' }),
  ).toBeVisible();
  await page.getByLabel('Website URL').fill('https://example.com');
  await page.getByRole('button', { name: 'Analyze website', exact: true }).click();
  await expect(page).toHaveURL(/\/scan\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { name: 'Inconclusive', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Scan evidence' })).toBeVisible();
  await expect(page.getByText('No validated risk score', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export JSON' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/webshield-.*\.json/);
  await page.getByRole('link', { name: 'Scan history', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Scan history' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View report' }).first()).toBeVisible();
});
test('crypto fixture is explicitly synthetic and displays address table', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Crypto investment/ }).click();
  await expect(page.getByText('Synthetic demo', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Cryptocurrency address candidates' }),
  ).toBeVisible();
  await expect(page.getByText('Unrealistic investment claim').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inconclusive', exact: true })).toBeVisible();
});
test('unsafe URL is rejected with accessible error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Website URL').fill('http://127.0.0.1');
  await page.getByRole('button', { name: 'Analyze website', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Website scanner' }).getByRole('alert'),
  ).toContainText('not allowed');
});
test('research and settings disclose missing model and providers; no horizontal overflow', async ({
  page,
}) => {
  await page.goto('/research');
  await expect(page.getByRole('heading', { name: 'Evidence before accuracy.' })).toBeVisible();
  await expect(page.getByText('Not evaluated').first()).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Know what is connected.' })).toBeVisible();
  await expect(page.getByText('Disabled').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('core pages meet automated accessibility checks and fit the viewport', async ({ page }) => {
  test.setTimeout(90000);
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  for (const path of ['/', '/history', '/research', '/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }
});

test('live reports show suspicious evidence and correct OpenPhish attribution', async ({
  page,
}) => {
  const report = {
    scan_id: '00000000-0000-4000-8000-000000000001',
    status: 'partial',
    submitted_url: 'https://example.com/',
    normalized_url: 'https://example.com/',
    hostname: 'example.com',
    created_at: '2026-10-11T10:00:00.000Z',
    started_at: '2026-10-11T10:00:00.000Z',
    completed_at: '2026-10-11T10:00:01.000Z',
    error: null,
    fixture: null,
    demo: false,
    assessment: {
      category: 'suspicious',
      numeric_score: null,
      score_kind: 'unavailable',
      model_version: null,
      summary: 'Live page analysis found warning signs.',
      is_verified_malicious: false,
    },
    checks: [
      {
        name: 'Page content',
        status: 'completed',
        source: 'Isolated static HTML scan',
        observedAt: '2026-10-11T10:00:00.000Z',
        detail: 'Bounded static HTML inspected.',
      },
    ],
    signals: [
      {
        code: 'credential_destination_mismatch',
        label: 'Credential form points to another domain',
        severity: 'high',
        evidence: 'Password form action differs from the inspected domain.',
        source: 'Isolated static HTML scan',
        confidence: 'heuristic',
        observedAt: '2026-10-11T10:00:00.000Z',
      },
    ],
    features: {},
    limitations: ['Static HTML only; JavaScript was not executed.'],
    crypto: { detected: false, addresses: [], claims: [] },
    content: {
      url: 'https://example.com/',
      finalUrl: 'https://example.com/',
      title: 'Observed account page',
      forms: [],
      linkDomains: [],
      iframeCount: 0,
      redirects: [],
      observedAt: '2026-10-11T10:00:00.000Z',
    },
  };
  await page.route(`**/api/v1/scans/${report.scan_id}`, (route) => route.fulfill({ json: report }));
  await page.goto(`/scan/${report.scan_id}`);
  await expect(page.getByRole('heading', { name: 'Suspicious', exact: true })).toBeVisible();
  await expect(page.getByText('Rule-based warning', { exact: true })).toBeVisible();
  await expect(page.getByText('Observed account page', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic demo', { exact: true })).toHaveCount(0);
  report.assessment.category = 'confirmed_malicious';
  report.assessment.is_verified_malicious = true;
  Object.assign(report, { provider_source: 'OpenPhish Community Feed' });
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'OpenPhish Community Feed', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Advisory provided by Google')).toHaveCount(0);
});

test('installed model estimates and measured research results are visible with their scope', async ({
  page,
}) => {
  const id = '00000000-0000-4000-8000-000000000002';
  const time = '2026-10-12T00:00:00.000Z';
  await page.route(`**/api/v1/scans/${id}`, (route) =>
    route.fulfill({
      json: {
        scan_id: id,
        status: 'partial',
        submitted_url: 'https://example.com/',
        normalized_url: 'https://example.com/',
        hostname: 'example.com',
        created_at: time,
        started_at: time,
        completed_at: time,
        fixture: null,
        demo: false,
        error: null,
        assessment: {
          category: 'high_risk',
          numeric_score: 90,
          score_kind: 'model_probability',
          model_version: 'measured-v1',
          model_probability: 0.9,
          model_threshold: 0.7,
          model_scope: 'phishing',
          summary: 'Elevated phishing estimate',
          is_verified_malicious: false,
        },
        checks: [],
        signals: [],
        features: {},
        limitations: ['Phishing scope only'],
        providers: [
          {
            source: 'Test provider',
            checkedAt: time,
            expiresAt: '2026-10-12T00:05:00.000Z',
            status: 'expired',
            reportedMalicious: true,
            detail: 'Historical match',
          },
        ],
        crypto: { detected: false, addresses: [], claims: [] },
      },
    }),
  );
  await page.goto(`/scan/${id}`);
  await expect(page.getByText('90.0%', { exact: true })).toBeVisible();
  await expect(page.getByText('Phishing model estimate', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Threat provider freshness' })).toContainText(
    'expired',
  );
  await page.route('**/api/v1/model-info', (route) =>
    route.fulfill({
      json: {
        available: true,
        model_version: 'measured-v1',
        feature_version: 'lexical-v1',
        scope: 'phishing',
        threshold: 0.7,
        message: 'Benchmark model',
        metrics: {
          hist_gradient_boosting: {
            per_class: { '1': { precision: 0.96, recall: 0.93, f1: 0.94, support: 100 } },
            false_positive_rate: 0.02,
          },
        },
        evaluation: {
          protocol: 'group-disjoint',
          selected_model: 'hist_gradient_boosting',
          counts: { test: 200 },
        },
      },
    }),
  );
  await page.goto('/research');
  await expect(page.getByRole('table', { name: 'Model evaluation status' })).toContainText('96.0%');
  await expect(page.getByText('group-disjoint', { exact: false })).toBeVisible();
});
