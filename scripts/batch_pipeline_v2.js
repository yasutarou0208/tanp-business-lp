#!/usr/bin/env node
/**
 * business.tanp.jp 全ページ MHTML→静的HTML 一括変換パイプライン v2
 * - cid: CSS参照を正しくインライン化
 * - iframe (form.run等) を実URLに変換
 * - 画像をBase64埋め込み
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://business.tanp.jp';
const GITHUB_PAGES_BASE = '/tanp-business-lp';
const OUTPUT_DIR = path.resolve(__dirname, '..');

const PAGES = [
  { urlPath: '/', outputDir: '' },
  { urlPath: '/contact', outputDir: 'contact' },
  { urlPath: '/contact/complete', outputDir: 'contact/complete' },
  { urlPath: '/contact/download', outputDir: 'contact/download' },
  { urlPath: '/service/ticket', outputDir: 'service/ticket' },
  { urlPath: '/service/birthday', outputDir: 'service/birthday' },
  { urlPath: '/service/souvenir', outputDir: 'service/souvenir' },
  { urlPath: '/scene/corporate-anniversary', outputDir: 'scene/corporate-anniversary' },
  { urlPath: '/scene/graduation', outputDir: 'scene/graduation' },
  { urlPath: '/scene/long-service', outputDir: 'scene/long-service' },
  { urlPath: '/scene/summer-gift', outputDir: 'scene/summer-gift' },
  { urlPath: '/case/EE6MsV9k', outputDir: 'case/EE6MsV9k' },
  { urlPath: '/case/funds', outputDir: 'case/funds' },
  { urlPath: '/case/scope', outputDir: 'case/scope' },
  { urlPath: '/case/wizleap', outputDir: 'case/wizleap' },
];

const FAQ_SCRIPT = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button[id^="studio-toggle-button-"]');
    if (!btn) return;
    e.preventDefault();
    var isCurrentlyClosed = btn.classList.contains('_isClose');
    btn.classList.toggle('_isClose');
    btn.setAttribute('aria-expanded', isCurrentlyClosed ? 'true' : 'false');
    var container = btn.closest('.sd');
    if (!container) return;
    container = container.parentElement;
    if (!container) return;
    var panels = container.querySelectorAll(':scope > .sd');
    panels.forEach(function(panel) {
      if (panel.contains(btn) || panel === btn) return;
      if (panel.classList.contains('_isClose') || panel.getAttribute('aria-hidden')) {
        panel.classList.toggle('_isClose');
        panel.setAttribute('aria-hidden', isCurrentlyClosed ? 'false' : 'true');
      }
    });
  });
})();
</script>`;

function decodeQuotedPrintable(str) {
  // First remove soft line breaks
  const cleaned = str.replace(/=\r?\n/g, '');
  // Convert =XX sequences to bytes, then decode as UTF-8
  const bytes = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length && /[0-9A-Fa-f]{2}/.test(cleaned.substring(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      // ASCII character - push its char code
      bytes.push(cleaned.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf-8');
}

/**
 * Parse MHTML into parts with proper cid: resolution
 */
function parseMhtml(mhtmlContent) {
  // Find boundary
  const boundaryMatch = mhtmlContent.match(/boundary="([^"]+)"/);
  if (!boundaryMatch) {
    const altMatch = mhtmlContent.match(/boundary=(\S+)/);
    if (!altMatch) throw new Error('No MHTML boundary found');
    return parseParts(mhtmlContent, altMatch[1]);
  }
  return parseParts(mhtmlContent, boundaryMatch[1]);
}

function parseParts(mhtmlContent, boundary) {
  const rawParts = mhtmlContent.split('--' + boundary);
  const parts = [];

  for (const raw of rawParts) {
    if (raw.trim() === '' || raw.trim() === '--') continue;

    const headerEnd = raw.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerStr = raw.substring(0, headerEnd);
    const body = raw.substring(headerEnd + 4);

    const getHeader = (name) => {
      const re = new RegExp(`${name}:\\s*([^\\r\\n]+(?:\\r?\\n\\s+[^\\r\\n]+)*)`, 'i');
      const m = headerStr.match(re);
      return m ? m[1].replace(/\r?\n\s+/g, '') : '';
    };

    parts.push({
      contentType: getHeader('Content-Type').split(';')[0].trim(),
      contentId: getHeader('Content-ID').replace(/[<>]/g, ''),
      contentLocation: getHeader('Content-Location'),
      contentTransferEncoding: getHeader('Content-Transfer-Encoding').toLowerCase(),
      body: body,
    });
  }

  return parts;
}

/**
 * Build final HTML from MHTML parts
 */
function buildHtml(parts) {
  // Find main HTML part
  const htmlPart = parts.find(p => p.contentType === 'text/html' &&
    (p.contentLocation.includes('business.tanp.jp') || p.contentLocation.startsWith('https://business.tanp.jp')));

  if (!htmlPart) throw new Error('No HTML part found');

  let html = htmlPart.body;
  if (htmlPart.contentTransferEncoding === 'quoted-printable') {
    html = decodeQuotedPrintable(html);
  }

  // Build resource maps by content-location and content-id
  const resourceByLocation = new Map();
  const resourceById = new Map();

  for (const part of parts) {
    if (part === htmlPart) continue;

    let content = part.body;
    if (part.contentTransferEncoding === 'quoted-printable') {
      content = decodeQuotedPrintable(content);
    } else if (part.contentTransferEncoding === 'base64') {
      // Keep as-is for binary, decode for text
      if (part.contentType.startsWith('text/') || part.contentType.includes('css')) {
        content = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
      }
    }

    if (part.contentLocation) {
      resourceByLocation.set(part.contentLocation, { ...part, decodedContent: content });
    }
    if (part.contentId) {
      resourceById.set(part.contentId, { ...part, decodedContent: content });
    }
  }

  // 1. Replace cid: CSS links with inline <style>
  html = html.replace(/<link[^>]*href="(cid:[^"]+)"[^>]*>/gi, (match, cidUrl) => {
    const resource = resourceByLocation.get(cidUrl);
    if (resource && (resource.contentType.includes('css') || resource.contentType.includes('text/'))) {
      return `<style>\n${resource.decodedContent}\n</style>`;
    }
    return ''; // Remove unresolved cid links
  });

  // 2. Replace cid: iframe src with actual URLs
  html = html.replace(/(<iframe[^>]*?)src="cid:([^"]+)"([^>]*>)/gi, (match, before, cidRef, after) => {
    // Find the iframe content part
    const frameId = cidRef;
    for (const part of parts) {
      if (part.contentId === frameId && part.contentLocation && !part.contentLocation.startsWith('cid:')) {
        return `${before}src="${part.contentLocation}"${after}`;
      }
    }
    // Try to find form.run or other external URL in parts
    for (const part of parts) {
      if (part.contentType === 'text/html' && part !== htmlPart &&
          part.contentLocation && part.contentLocation.includes('form.run')) {
        return `${before}src="${part.contentLocation}"${after}`;
      }
    }
    return match;
  });

  // 3. Replace cid: image src with base64 data URIs
  html = html.replace(/src="(cid:[^"]+)"/gi, (match, cidUrl) => {
    const resource = resourceByLocation.get(cidUrl) || resourceById.get(cidUrl.replace('cid:', ''));
    if (resource && resource.contentType.startsWith('image/')) {
      const base64 = resource.contentTransferEncoding === 'base64'
        ? resource.body.replace(/\s/g, '')
        : Buffer.from(resource.body).toString('base64');
      return `src="data:${resource.contentType};base64,${base64}"`;
    }
    return match;
  });

  // 4. Inline external CSS from same domain
  html = html.replace(/<link[^>]*href="(https:\/\/business\.tanp\.jp[^"]*\.css[^"]*)"[^>]*>/gi, (match, url) => {
    const resource = resourceByLocation.get(url);
    if (resource) {
      return `<style>\n${resource.decodedContent}\n</style>`;
    }
    return match; // Keep external link if not in MHTML
  });

  // 5. Inline images from storage.googleapis.com
  for (const [location, resource] of resourceByLocation) {
    if (resource.contentType.startsWith('image/') && location.startsWith('https://')) {
      const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const base64 = resource.contentTransferEncoding === 'base64'
        ? resource.body.replace(/\s/g, '')
        : Buffer.from(resource.body).toString('base64');
      const dataUri = `data:${resource.contentType};base64,${base64}`;
      html = html.replace(new RegExp(escaped, 'g'), dataUri);
    }
  }

  // 6. Remove @font-face (use Google Fonts CDN instead)
  html = html.replace(/@font-face\s*\{[^}]*\}/g, '');

  // 7. Ensure Google Fonts CDN
  if (!html.includes('fonts.googleapis.com/css2?family=Noto+Sans+JP')) {
    const fontLinks = '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&family=Inter:wght@100..900&family=Noto+Serif:wght@400;700&display=swap">';
    html = html.replace(/<head>/i, '<head>\n' + fontLinks);
  }

  // 8. Remove Nuxt runtime scripts
  html = html.replace(/<script[^>]*src="[^"]*_nuxt[^"]*"[^>]*><\/script>/g, '');
  html = html.replace(/<script[^>]*>[\s\S]*?__NUXT__[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link[^>]*href="[^"]*_nuxt[^"]*"[^>]*>/g, '');
  html = html.replace(/<link[^>]*modulepreload[^>]*>/gi, '');

  // 9. Fix internal links
  html = html.replace(
    /href="https:\/\/business\.tanp\.jp(\/[^"]*?)"/g,
    (match, urlPath) => {
      if (urlPath === '/') return `href="${GITHUB_PAGES_BASE}/"`;
      const cleanPath = urlPath.replace(/\/$/, '');
      return `href="${GITHUB_PAGES_BASE}${cleanPath}/"`;
    }
  );
  html = html.replace(
    /href="\/(contact|service|scene|case)([^"]*?)"/g,
    (match, section, rest) => {
      const cleanPath = `/${section}${rest}`.replace(/\/$/, '');
      return `href="${GITHUB_PAGES_BASE}${cleanPath}/"`;
    }
  );

  // 10. Inject FAQ script
  if (html.includes('</body>')) {
    html = html.replace('</body>', FAQ_SCRIPT + '\n</body>');
  } else {
    html += FAQ_SCRIPT + '\n</body></html>';
  }

  return html;
}

async function fetchPageMhtml(page, url) {
  console.log(`  Navigating to ${url}...`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.warn(`  Warning: timeout for ${url}, continuing...`);
  }
  await page.waitForTimeout(3000);

  const client = await page.context().newCDPSession(page);
  const { data } = await client.send('Page.captureSnapshot', { format: 'mhtml' });
  await client.detach();
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find(a => a.startsWith('--only='));
  const onlyPages = onlyArg ? onlyArg.replace('--only=', '').split(',') : null;

  let pagesToProcess = PAGES;
  if (onlyPages) {
    pagesToProcess = PAGES.filter(p => onlyPages.includes(p.urlPath) || onlyPages.includes(p.outputDir));
  }

  console.log(`\n=== TANP Business LP Batch Pipeline v2 ===`);
  console.log(`Processing ${pagesToProcess.length} pages\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const results = [];

  for (const pageInfo of pagesToProcess) {
    const url = BASE_URL + pageInfo.urlPath;
    const outputPath = pageInfo.outputDir
      ? path.join(OUTPUT_DIR, pageInfo.outputDir, 'index.html')
      : path.join(OUTPUT_DIR, 'index.html');

    console.log(`\n[${pageInfo.urlPath}]`);

    try {
      const page = await context.newPage();
      const mhtml = await fetchPageMhtml(page, url);

      // Save raw MHTML
      const mhtmlDir = path.join(OUTPUT_DIR, 'scripts', 'mhtml_cache');
      fs.mkdirSync(mhtmlDir, { recursive: true });
      const mhtmlFile = pageInfo.urlPath === '/' ? 'index' : pageInfo.urlPath.slice(1).replace(/\//g, '_');
      fs.writeFileSync(path.join(mhtmlDir, mhtmlFile + '.mhtml'), mhtml);

      // Parse and build
      const parts = parseMhtml(mhtml);
      console.log(`  Parsed ${parts.length} MHTML parts`);

      const processedHtml = buildHtml(parts);

      // Write output
      const outputDir = path.dirname(outputPath);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(outputPath, processedHtml);

      const size = (Buffer.byteLength(processedHtml) / 1024).toFixed(1);
      console.log(`  ✓ Saved (${size} KB)`);
      results.push({ url, status: 'ok', size: `${size} KB`, outputPath });

      await page.close();
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ url, status: 'error', error: err.message });
    }
  }

  await browser.close();

  // Summary
  console.log('\n\n=== Summary ===');
  const ok = results.filter(r => r.status === 'ok');
  const errors = results.filter(r => r.status === 'error');
  console.log(`Success: ${ok.length}, Failed: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Failed pages:');
    errors.forEach(e => console.log(`  - ${e.url}: ${e.error}`));
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'scripts', 'batch_results.json'),
    JSON.stringify(results, null, 2)
  );
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
