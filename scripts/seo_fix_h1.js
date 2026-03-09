#!/usr/bin/env node
/**
 * H1タグの追加修正 - 空のH1や不適切なH1を修正
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..');

const H1_FIXES = {
  'service/birthday/index.html': '従業員向け誕生日ギフト',
  'scene/graduation/index.html': '卒業記念品・卒園記念品ギフト特集',
};

for (const [file, h1Text] of Object.entries(H1_FIXES)) {
  const filePath = path.join(OUTPUT_DIR, file);
  let html = fs.readFileSync(filePath, 'utf-8');

  // Remove empty/bad H1 tags
  html = html.replace(/<h1[^>]*>[\s]*<\/h1>/gi, '');
  html = html.replace(/<h1[^>]*class="hero-title"[^>]*>[\s\S]*?<\/h1>/gi, '');
  html = html.replace(/<h1[^>]*class="text-3xl[^"]*"[^>]*>[\s\S]*?<\/h1>/gi, '');

  // Add proper H1
  if (!/<h1[\s>]/i.test(html)) {
    const h1Tag = `<h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">${h1Text}</h1>`;
    html = html.replace(/<body[^>]*>/, `$&\n${h1Tag}`);
    console.log(`✓ ${file}: H1 fixed to "${h1Text}"`);
  } else {
    console.log(`- ${file}: H1 already exists, skipping`);
  }

  fs.writeFileSync(filePath, html);
}

// Also check souvenir - it has H1 with text, good but let's verify
const souvenirPath = path.join(OUTPUT_DIR, 'service/souvenir/index.html');
const souvenirHtml = fs.readFileSync(souvenirPath, 'utf-8');
const souvenirH1 = souvenirHtml.match(/<h1[^>]*>([^<]*)</);
if (souvenirH1) {
  console.log(`- service/souvenir: H1 exists: "${souvenirH1[1].trim()}"`);
}
