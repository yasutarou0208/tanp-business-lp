#!/usr/bin/env node
/**
 * 全ページの品質チェック
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..');
const GITHUB_PAGES_BASE = '/tanp-business-lp';

const PAGES = [
  { path: '', file: 'index.html' },
  { path: 'contact', file: 'contact/index.html' },
  { path: 'contact/complete', file: 'contact/complete/index.html' },
  { path: 'contact/download', file: 'contact/download/index.html' },
  { path: 'service/ticket', file: 'service/ticket/index.html' },
  { path: 'service/birthday', file: 'service/birthday/index.html' },
  { path: 'service/souvenir', file: 'service/souvenir/index.html' },
  { path: 'scene/corporate-anniversary', file: 'scene/corporate-anniversary/index.html' },
  { path: 'scene/graduation', file: 'scene/graduation/index.html' },
  { path: 'scene/long-service', file: 'scene/long-service/index.html' },
  { path: 'scene/summer-gift', file: 'scene/summer-gift/index.html' },
  { path: 'case/EE6MsV9k', file: 'case/EE6MsV9k/index.html' },
  { path: 'case/funds', file: 'case/funds/index.html' },
  { path: 'case/scope', file: 'case/scope/index.html' },
  { path: 'case/wizleap', file: 'case/wizleap/index.html' },
];

let totalSize = 0;

for (const page of PAGES) {
  const filePath = path.join(OUTPUT_DIR, page.file);
  if (!fs.existsSync(filePath)) {
    console.log(`✗ MISSING: ${page.file}`);
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf-8');
  const size = Buffer.byteLength(html);
  totalSize += size;

  const checks = {
    hasTitle: /<title>[^<]+<\/title>/.test(html),
    hasFaqScript: html.includes('studio-toggle-button-'),
    hasGoogleFonts: html.includes('fonts.googleapis.com'),
    noNuxtScripts: !/<script[^>]*_nuxt[^>]*>/.test(html),
    noAbsoluteBusinessLinks: !/href="https:\/\/business\.tanp\.jp/.test(html),
    hasGithubPagesLinks: html.includes(GITHUB_PAGES_BASE) || page.path === '',
    imageCount: (html.match(/data:image\//g) || []).length,
    externalImageCount: (html.match(/src="https:\/\/storage\.googleapis\.com/g) || []).length,
  };

  const issues = [];
  if (!checks.hasTitle) issues.push('no-title');
  if (!checks.noNuxtScripts) issues.push('has-nuxt');
  if (!checks.noAbsoluteBusinessLinks) issues.push('absolute-links');
  if (!checks.hasGoogleFonts) issues.push('no-fonts');

  const sizeKB = (size / 1024).toFixed(1);
  const status = issues.length === 0 ? '✓' : '⚠';
  console.log(`${status} ${page.file.padEnd(45)} ${sizeKB.padStart(8)} KB | imgs:${checks.imageCount}+${checks.externalImageCount}ext ${issues.length > 0 ? '| ' + issues.join(', ') : ''}`);
}

console.log(`\nTotal size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
