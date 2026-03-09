#!/usr/bin/env node
/**
 * 全ページのスクリーンショット取得 + FAQ動作テスト
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'scripts', 'screenshots');

const PAGES = [
  { name: 'index', file: 'index.html' },
  { name: 'contact', file: 'contact/index.html' },
  { name: 'contact-complete', file: 'contact/complete/index.html' },
  { name: 'contact-download', file: 'contact/download/index.html' },
  { name: 'service-ticket', file: 'service/ticket/index.html' },
  { name: 'service-birthday', file: 'service/birthday/index.html' },
  { name: 'service-souvenir', file: 'service/souvenir/index.html' },
  { name: 'scene-corporate-anniversary', file: 'scene/corporate-anniversary/index.html' },
  { name: 'scene-graduation', file: 'scene/graduation/index.html' },
  { name: 'scene-long-service', file: 'scene/long-service/index.html' },
  { name: 'scene-summer-gift', file: 'scene/summer-gift/index.html' },
  { name: 'case-EE6MsV9k', file: 'case/EE6MsV9k/index.html' },
  { name: 'case-funds', file: 'case/funds/index.html' },
  { name: 'case-scope', file: 'case/scope/index.html' },
  { name: 'case-wizleap', file: 'case/wizleap/index.html' },
];

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  for (const pageInfo of PAGES) {
    const filePath = path.join(OUTPUT_DIR, pageInfo.file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${pageInfo.file} (not found)`);
      continue;
    }

    const page = await context.newPage();
    await page.goto('file://' + filePath, { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Take full page screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${pageInfo.name}.png`),
      fullPage: true
    });
    console.log(`✓ ${pageInfo.name}.png`);

    // Test FAQ toggle if present
    const toggleButtons = await page.$$('button[id^="studio-toggle-button-"]');
    if (toggleButtons.length > 0) {
      console.log(`  Found ${toggleButtons.length} FAQ toggles, testing first one...`);

      // Click first toggle
      await toggleButtons[0].click();
      await page.waitForTimeout(500);

      // Check if _isClose was toggled
      const btnClasses = await toggleButtons[0].getAttribute('class');
      const expanded = await toggleButtons[0].getAttribute('aria-expanded');
      console.log(`  After click: classes="${btnClasses}", aria-expanded="${expanded}"`);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${pageInfo.name}_faq_open.png`),
        fullPage: true
      });
    }

    await page.close();
  }

  await browser.close();
  console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
