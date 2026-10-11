import { test, expect } from '@playwright/test';

test('theme follows the device until a manual choice is made', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Configuration', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme switches even when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('both themes keep core pages readable, accessible and inside the viewport', async ({
  page,
}) => {
  test.setTimeout(120000);
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const path of ['/', '/history', '/research', '/settings']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(
        audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      const layout = await page.evaluate(
        (viewportWidth) => ({
          overflow: document.documentElement.scrollWidth > viewportWidth,
          smallText: Array.from(document.querySelectorAll('body *'))
            .filter((element) =>
              Array.from(element.childNodes).some(
                (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
              ),
            )
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 1 &&
                rect.height > 1 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                parseFloat(style.fontSize) < 14
              );
            })
            .map((element) => ({
              text: element.textContent?.trim().slice(0, 60),
              size: getComputedStyle(element).fontSize,
            })),
        }),
        page.viewportSize()!.width,
      );
      expect(layout).toEqual({ overflow: false, smallText: [] });
    }
  }
});
