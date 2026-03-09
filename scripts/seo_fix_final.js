#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const OUTPUT_DIR = path.resolve(__dirname, '..');

// 1. Fix &nbsp; in case page titles
const casePages = [
  'case/EE6MsV9k/index.html',
  'case/funds/index.html',
  'case/scope/index.html',
  'case/wizleap/index.html',
];

for (const file of casePages) {
  const filePath = path.join(OUTPUT_DIR, file);
  let html = fs.readFileSync(filePath, 'utf-8');

  // Clean &nbsp; from title
  html = html.replace(/<title>([^<]*?)&nbsp;<\/title>/, '<title>$1</title>');
  html = html.replace(/<title>([^<]*?)\u00a0<\/title>/, '<title>$1</title>');

  // Extract title and description for Article schema
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const descMatch = html.match(/name="description" content="([^"]+)"/);
  const canonicalMatch = html.match(/rel="canonical" href="([^"]+)"/);

  if (titleMatch && descMatch && canonicalMatch) {
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": titleMatch[1].trim(),
      "description": descMatch[1].substring(0, 200),
      "url": canonicalMatch[1],
      "publisher": {
        "@type": "Organization",
        "name": "TANP for Business",
        "url": "https://business.tanp.jp"
      },
      "author": {
        "@type": "Organization",
        "name": "TANP for Business"
      }
    };

    const schemaTag = `<script type="application/ld+json">\n${JSON.stringify(articleSchema, null, 2)}\n</script>`;
    html = html.replace('</head>', `${schemaTag}\n</head>`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`✓ ${file}: title cleaned, Article schema added`);
}

// 2. Fix index.html H1 (current is "ビジネスギフトで" which is partial)
const indexPath = path.join(OUTPUT_DIR, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf-8');
// The existing H1 is from the hero section. Let's add a proper SEO H1.
// Check if our SEO H1 already exists
if (!indexHtml.includes('法人向けギフト・おまとめ注文サービス')) {
  const seoH1 = '<h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">法人向けギフト・おまとめ注文サービス TANP for Business</h1>';
  indexHtml = indexHtml.replace(/<body[^>]*>/, `$&\n${seoH1}`);
  fs.writeFileSync(indexPath, indexHtml);
  console.log('✓ index.html: proper SEO H1 added');
}

console.log('\nDone!');
