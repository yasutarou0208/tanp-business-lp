#!/usr/bin/env node
/**
 * business.tanp.jp 全ページ MHTML→静的HTML 一括変換パイプライン
 *
 * Usage: node scripts/batch_pipeline.js [--skip-fetch] [--only=path1,path2]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://business.tanp.jp';
const GITHUB_PAGES_BASE = '/tanp-business-lp';
const OUTPUT_DIR = path.resolve(__dirname, '..');

// 全ページ定義
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

// FAQ アコーディオン JS
const FAQ_SCRIPT = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button[id^="studio-toggle-button-"]');
    if (!btn) return;
    e.preventDefault();

    var toggleId = btn.id.replace('studio-toggle-button-', '');
    var parent = btn.closest('.sd');
    var isCurrentlyClosed = btn.classList.contains('_isClose');

    // Find all elements that share this toggle group
    // The button, its parent container, and the content panel
    var allToggles = document.querySelectorAll(
      '#studio-toggle-button-' + toggleId +
      ', [data-toggle-id="' + toggleId + '"]'
    );

    // Toggle the button itself
    btn.classList.toggle('_isClose');
    btn.setAttribute('aria-expanded', isCurrentlyClosed ? 'true' : 'false');

    // Find the content container - it's the next sibling .sd element after the button's parent
    // Walk up to find the FAQ item container, then find the content panel
    var faqItem = btn.closest('.sd');
    if (faqItem) {
      // Toggle _isClose on all child .sd elements that have the class
      var children = faqItem.querySelectorAll('.sd');
      children.forEach(function(child) {
        if (child === btn) return;
        // Check if this child participates in the toggle (has _isClose in its initial state or is the content panel)
        if (child.style.height === '0px' || child.classList.contains('_isClose') || isCurrentlyClosed) {
          // Only toggle elements that are part of this FAQ toggle
          if (child.querySelector('[id^="studio-toggle-button-"]')) return; // skip nested FAQ items
        }
      });
    }

    // Better approach: find the parent that contains both the button and content,
    // then toggle _isClose on the parent's direct child .sd elements
    var container = btn.parentElement;
    while (container && !container.querySelector(':scope > .sd._isClose, :scope > .sd[aria-hidden]')) {
      container = container.parentElement;
      if (!container || container.tagName === 'BODY') { container = null; break; }
    }

    if (!container) {
      // Fallback: walk siblings
      container = btn.closest('.sd');
      if (!container) return;
      container = container.parentElement;
    }

    if (container) {
      var panels = container.querySelectorAll(':scope > .sd');
      panels.forEach(function(panel) {
        if (panel.contains(btn) || panel === btn) return;
        // This is likely the content panel
        if (panel.classList.contains('_isClose') || panel.getAttribute('aria-hidden')) {
          panel.classList.toggle('_isClose');
          panel.setAttribute('aria-hidden', isCurrentlyClosed ? 'false' : 'true');
        }
      });
    }
  });
})();
</script>
`;

/**
 * Parse MHTML content and extract HTML + inline resources
 */
function parseMhtml(mhtmlContent) {
  // Extract boundary
  const boundaryMatch = mhtmlContent.match(/boundary="([^"]+)"/);
  if (!boundaryMatch) {
    // Try without quotes
    const altMatch = mhtmlContent.match(/boundary=(\S+)/);
    if (!altMatch) throw new Error('No MHTML boundary found');
    return parseMhtmlWithBoundary(mhtmlContent, altMatch[1]);
  }
  return parseMhtmlWithBoundary(mhtmlContent, boundaryMatch[1]);
}

function parseMhtmlWithBoundary(mhtmlContent, boundary) {
  const parts = mhtmlContent.split('--' + boundary);
  const resources = [];
  let htmlContent = '';

  for (const part of parts) {
    if (part.trim() === '' || part.trim() === '--') continue;

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = part.substring(0, headerEnd);
    let body = part.substring(headerEnd + 4);

    const contentType = headers.match(/Content-Type:\s*([^\r\n;]+)/i);
    const contentLocation = headers.match(/Content-Location:\s*([^\r\n]+)/i);
    const contentTransferEncoding = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);

    const type = contentType ? contentType[1].trim() : '';
    const location = contentLocation ? contentLocation[1].trim() : '';
    const encoding = contentTransferEncoding ? contentTransferEncoding[1].trim() : '';

    if (type.includes('text/html') && !htmlContent) {
      if (encoding === 'quoted-printable') {
        body = decodeQuotedPrintable(body);
      }
      htmlContent = body;
    } else if (type.startsWith('image/') || type.includes('css') || type.includes('font')) {
      resources.push({ type, location, encoding, body: body.trim() });
    }
  }

  return { htmlContent, resources };
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Process HTML: inline CSS, convert images to base64, fix links
 */
function processHtml(html, resources) {
  let processed = html;

  // Build resource map
  const resourceMap = new Map();
  for (const res of resources) {
    if (res.location) {
      resourceMap.set(res.location, res);
    }
  }

  // Inline CSS from resources
  for (const res of resources) {
    if (res.type.includes('css') && res.location) {
      let cssContent = res.body;
      if (res.encoding === 'base64') {
        cssContent = Buffer.from(res.body, 'base64').toString('utf-8');
      }
      // Replace <link> with <style>
      const escaped = res.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const linkRegex = new RegExp(`<link[^>]*href=["']${escaped}["'][^>]*>`, 'gi');
      if (linkRegex.test(processed)) {
        processed = processed.replace(linkRegex, `<style>${cssContent}</style>`);
      }
    }
  }

  // Convert image src to base64 where possible
  for (const res of resources) {
    if (res.type.startsWith('image/') && res.location && res.encoding === 'base64') {
      const dataUri = `data:${res.type};base64,${res.body.replace(/\s/g, '')}`;
      const escaped = res.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      processed = processed.replace(new RegExp(escaped, 'g'), dataUri);
    }
  }

  // Remove @font-face declarations (keep Google Fonts CDN)
  processed = processed.replace(/@font-face\s*\{[^}]*\}/g, '');

  // Ensure Google Fonts CDN links are present
  if (!processed.includes('fonts.googleapis.com/css2')) {
    const fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&family=Inter:wght@100..900&family=Noto+Serif:wght@400;700&display=swap">';
    processed = processed.replace('<head>', '<head>\n' + fontLink);
  }

  // Remove Nuxt runtime scripts
  processed = processed.replace(/<script[^>]*src="[^"]*_nuxt[^"]*"[^>]*><\/script>/g, '');
  processed = processed.replace(/<script[^>]*>.*?__NUXT__.*?<\/script>/gs, '');
  processed = processed.replace(/<link[^>]*href="[^"]*_nuxt[^"]*"[^>]*>/g, '');

  // Fix internal links for GitHub Pages
  // Convert https://business.tanp.jp/xxx to /tanp-business-lp/xxx/
  processed = processed.replace(
    /href="https:\/\/business\.tanp\.jp(\/[^"]*?)"/g,
    (match, urlPath) => {
      if (urlPath === '/') return `href="${GITHUB_PAGES_BASE}/"`;
      // Remove trailing slash then add it back for consistency
      const cleanPath = urlPath.replace(/\/$/, '');
      return `href="${GITHUB_PAGES_BASE}${cleanPath}/"`;
    }
  );
  // Also handle relative links
  processed = processed.replace(
    /href="\/(contact|service|scene|case)([^"]*?)"/g,
    (match, section, rest) => {
      const cleanPath = `/${section}${rest}`.replace(/\/$/, '');
      return `href="${GITHUB_PAGES_BASE}${cleanPath}/"`;
    }
  );

  // Inject FAQ script before </body>
  processed = processed.replace('</body>', FAQ_SCRIPT + '</body>');

  // If no </body> tag, append
  if (!processed.includes('</body>')) {
    processed += FAQ_SCRIPT + '</body></html>';
  }

  return processed;
}

/**
 * Fetch a page using Playwright CDP and return MHTML
 */
async function fetchPageMhtml(page, url) {
  console.log(`  Navigating to ${url}...`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.warn(`  Warning: Navigation timeout for ${url}, continuing anyway...`);
  }

  // Wait a bit for any lazy-loaded content
  await page.waitForTimeout(2000);

  // Use CDP to capture MHTML snapshot
  const client = await page.context().newCDPSession(page);
  const { data } = await client.send('Page.captureSnapshot', { format: 'mhtml' });
  await client.detach();

  return data;
}

/**
 * Alternative: directly extract rendered HTML + computed styles
 */
async function fetchPageDirect(page, url) {
  console.log(`  Navigating to ${url}...`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.warn(`  Warning: Navigation timeout for ${url}, continuing anyway...`);
  }

  await page.waitForTimeout(3000);

  // Get the full HTML
  const html = await page.content();

  // Get all stylesheets content
  const styles = await page.evaluate(() => {
    const sheets = [];
    for (const sheet of document.styleSheets) {
      try {
        let css = '';
        for (const rule of sheet.cssRules) {
          css += rule.cssText + '\n';
        }
        sheets.push(css);
      } catch (e) {
        // Cross-origin stylesheet - get the href
        if (sheet.href) {
          sheets.push(`/* External: ${sheet.href} */`);
        }
      }
    }
    return sheets;
  });

  return { html, styles };
}

async function main() {
  const args = process.argv.slice(2);
  const skipFetch = args.includes('--skip-fetch');
  const onlyArg = args.find(a => a.startsWith('--only='));
  const onlyPages = onlyArg ? onlyArg.replace('--only=', '').split(',') : null;

  let pagesToProcess = PAGES;
  if (onlyPages) {
    pagesToProcess = PAGES.filter(p => onlyPages.includes(p.urlPath) || onlyPages.includes(p.outputDir));
  }

  // Skip root page (already done) unless explicitly requested
  if (!onlyPages) {
    pagesToProcess = pagesToProcess.filter(p => p.urlPath !== '/');
  }

  console.log(`\n=== TANP Business LP Batch Pipeline ===`);
  console.log(`Processing ${pagesToProcess.length} pages\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

      // Try MHTML approach first
      const mhtml = await fetchPageMhtml(page, url);

      // Save raw MHTML for debugging
      const mhtmlDir = path.join(OUTPUT_DIR, 'scripts', 'mhtml_cache');
      fs.mkdirSync(mhtmlDir, { recursive: true });
      const mhtmlFile = pageInfo.urlPath === '/' ? 'index' : pageInfo.urlPath.replace(/\//g, '_');
      fs.writeFileSync(path.join(mhtmlDir, mhtmlFile + '.mhtml'), mhtml);

      // Parse and process
      const { htmlContent, resources } = parseMhtml(mhtml);

      if (!htmlContent) {
        console.error(`  ERROR: No HTML content extracted for ${url}`);
        results.push({ url, status: 'error', error: 'No HTML content' });
        await page.close();
        continue;
      }

      const processedHtml = processHtml(htmlContent, resources);

      // Write output
      const outputDir = path.dirname(outputPath);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(outputPath, processedHtml);

      const size = (Buffer.byteLength(processedHtml) / 1024).toFixed(1);
      console.log(`  ✓ Saved to ${outputPath} (${size} KB)`);
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

  // Save results
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'scripts', 'batch_results.json'),
    JSON.stringify(results, null, 2)
  );
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
