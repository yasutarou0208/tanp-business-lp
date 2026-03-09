#!/usr/bin/env node
/**
 * 既存 index.html にリンク変換 + FAQ スクリプト注入を適用
 */

const fs = require('fs');
const path = require('path');

const GITHUB_PAGES_BASE = '/tanp-business-lp';
const INDEX_PATH = path.resolve(__dirname, '..', 'index.html');

const FAQ_SCRIPT = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button[id^="studio-toggle-button-"]');
    if (!btn) return;
    e.preventDefault();

    var toggleId = btn.id.replace('studio-toggle-button-', '');
    var isCurrentlyClosed = btn.classList.contains('_isClose');

    // Toggle the button itself
    btn.classList.toggle('_isClose');
    btn.setAttribute('aria-expanded', isCurrentlyClosed ? 'true' : 'false');

    // Find the parent that contains both the button and content panel
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
</script>
`;

let html = fs.readFileSync(INDEX_PATH, 'utf-8');

// Fix internal links
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

// Remove any existing FAQ script injection to avoid duplicates
html = html.replace(/<script>\s*\(function\(\)\s*\{\s*document\.addEventListener\('click',\s*function\(e\)\s*\{[\s\S]*?studio-toggle-button[\s\S]*?\}\);\s*\}\)\(\);\s*<\/script>/g, '');

// Inject FAQ script before </body>
if (html.includes('</body>')) {
  html = html.replace('</body>', FAQ_SCRIPT + '</body>');
} else {
  html += FAQ_SCRIPT;
}

fs.writeFileSync(INDEX_PATH, html);
console.log('✓ index.html updated with link fixes + FAQ script');
console.log(`  Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
