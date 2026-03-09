#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Use a simple HTTP server approach - serve from GitHub Pages URL
  // Or test locally with the file
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Scroll to FAQ section
  const faqHeading = await page.$('text=よくあるご質問');
  if (faqHeading) {
    await faqHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'faq_section.png'),
    clip: { x: 0, y: Math.max(0, (await faqHeading?.boundingBox())?.y - 50 || 0), width: 1440, height: 800 }
  });
  console.log('✓ faq_section.png');

  await browser.close();
}

main().catch(console.error);
