import { chromium } from '@playwright/test';

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const outPath = process.env.SMOKE_SCREENSHOT ?? 'artifacts/shader-lighting-panel.png';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });

await page.getByRole('button', { name: /Shader/i }).click();
await page.waitForTimeout(300);

const panel = page.locator('.inspector .panel').filter({ hasText: 'Dynamic Light Shader' });
await panel.waitFor({ state: 'visible', timeout: 5000 });

const canvasBox = await page.locator('canvas.canvas').boundingBox();
const panelBox = await panel.boundingBox();
if (!canvasBox || !panelBox) {
  throw new Error('Canvas or shader panel not visible for smoke test');
}

const panelRight = panelBox.x + panelBox.width;
const canvasRight = canvasBox.x + canvasBox.width;
if (panelBox.x <= canvasRight) {
  throw new Error(`Shader panel is not on the right side of canvas (panel x=${panelBox.x}, canvasRight=${canvasRight})`);
}

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(`Smoke test passed, screenshot written to ${outPath}`);
