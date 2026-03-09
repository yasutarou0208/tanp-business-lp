#!/usr/bin/env node
/**
 * SEO一括修正スクリプト
 * - H1タグ追加
 * - title/meta description個別化
 * - canonicalタグ修正（business.tanp.jp向け）
 * - 画像alt属性追加
 * - 構造化データ（Organization, WebPage, FAQPage）追加
 * - contact/complete に noindex
 * - OGP修正
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..');
const SITE_URL = 'https://business.tanp.jp';

// 各ページのSEOメタデータ定義
const PAGE_SEO = {
  'index.html': {
    title: '法人向けギフト・おまとめ注文 | TANP for Business',
    description: 'TANP for Businessは法人・団体向けのギフトサービスです。周年記念品、永年勤続表彰、お中元、誕生日ギフトなど、シーンに合わせたおしゃれなプレゼントをご提案。名入れやラッピングなど豊富なオプションで特別感のあるギフトをお届けします。',
    h1: '法人向けギフト・おまとめ注文サービス TANP for Business',
    canonical: '/',
    hasFaq: true,
    ogType: 'website',
  },
  'contact/index.html': {
    title: 'お問い合わせ・ご相談 | TANP for Business',
    description: 'TANP for Businessへのお問い合わせページです。法人ギフトのご相談、見積もり依頼、サービスに関するご質問など、お気軽にお問い合わせください。専任スタッフが丁寧にご対応いたします。',
    h1: 'お問い合わせ・ご相談',
    canonical: '/contact',
    ogType: 'website',
  },
  'contact/complete/index.html': {
    title: 'お問い合わせ完了 | TANP for Business',
    description: 'お問い合わせありがとうございます。内容を確認の上、担当者よりご連絡いたします。',
    h1: 'お問い合わせありがとうございます',
    canonical: '/contact/complete',
    noindex: true,
    ogType: 'website',
  },
  'contact/download/index.html': {
    title: '資料ダウンロード | TANP for Business',
    description: 'TANP for Businessのサービス資料をダウンロードいただけます。法人ギフトの料金プラン、導入事例、サービス詳細をまとめた資料をご用意しております。',
    h1: '資料ダウンロード',
    canonical: '/contact/download',
    ogType: 'website',
  },
  'service/ticket/index.html': {
    title: 'TANP Ticket - オーダーメイド デジタルカタログギフト | TANP for Business',
    description: 'TANP Ticketは約2万点の商品から法人様別にオーダーメイドで作成するデジタルカタログギフトです。名入れやオリジナル包装紙での梱包にも対応。福利厚生、社員表彰、販売促進のノベルティなど様々なシーンでご活用いただけます。',
    h1: null, // Already has H1
    canonical: '/service/ticket',
    ogType: 'website',
  },
  'service/birthday/index.html': {
    title: '従業員向け誕生日ギフト・福利厚生ギフト | TANP for Business',
    description: 'TANP for Businessの従業員向け誕生日ギフトサービス。福利厚生として社員の誕生日にギフトを贈ることで、エンゲージメント向上と離職率低下を実現。名入れやメッセージカード付きで特別感のある誕生日プレゼントをお届けします。',
    h1: '従業員向け誕生日ギフト',
    canonical: '/service/birthday',
    ogType: 'website',
  },
  'service/souvenir/index.html': {
    title: '引菓子・ノベルティギフト | TANP for Business',
    description: 'TANP for Businessの引菓子・ノベルティギフトサービス。結婚式の引菓子やイベントのノベルティに最適なギフトを豊富にご用意。名入れやオリジナルラッピングなどカスタマイズも可能です。',
    h1: '引菓子・ノベルティギフト',
    canonical: '/service/souvenir',
    ogType: 'website',
  },
  'scene/corporate-anniversary/index.html': {
    title: '周年記念品・創立記念ギフト特集 | TANP for Business',
    description: 'TANP for Businessの周年記念品特集。企業の創立記念や設立○周年の節目に贈る特別なギフトをご提案。名入れやオリジナルラッピングで企業ブランドを表現した記念品をお届けします。',
    h1: '周年記念品・創立記念ギフト特集',
    canonical: '/scene/corporate-anniversary',
    hasFaq: true,
    ogType: 'website',
  },
  'scene/graduation/index.html': {
    title: '卒業記念品・卒園記念品ギフト特集 | TANP for Business',
    description: 'TANP for Businessの卒業記念品特集。卒業・卒園のお祝いにふさわしい特別なギフトをご提案。名入れやオリジナルラッピングで思い出に残る記念品をお届けします。',
    h1: '卒業記念品・卒園記念品ギフト特集',
    canonical: '/scene/graduation',
    ogType: 'website',
  },
  'scene/long-service/index.html': {
    title: '永年勤続表彰の記念品・報奨ギフト | TANP for Business',
    description: 'TANP for Businessの永年勤続記念品特集。10年・20年・30年の節目に贈る特別な記念品をご提案。名入れやオリジナルラッピングで感謝の気持ちを込めたギフトをお届けします。',
    h1: '永年勤続表彰 記念品・報奨ギフト',
    canonical: '/scene/long-service',
    hasFaq: true,
    ogType: 'website',
  },
  'scene/summer-gift/index.html': {
    title: '法人向けお中元ギフト・夏の贈り物特集 | TANP for Business',
    description: 'TANP for Businessの法人向けお中元特集。取引先企業やお得意様への夏の贈り物に最適なギフトをご提案。名入れやオリジナルラッピングで日頃の感謝を伝える上質なお中元ギフトをお届けします。',
    h1: '法人向けお中元ギフト・夏の贈り物特集',
    canonical: '/scene/summer-gift',
    hasFaq: true,
    ogType: 'website',
  },
  'case/EE6MsV9k/index.html': {
    title: null, // Keep original
    description: null, // Keep original
    h1: null, // Already has H1
    canonical: '/case/EE6MsV9k',
    ogType: 'article',
  },
  'case/funds/index.html': {
    title: null,
    description: null,
    h1: null,
    canonical: '/case/funds',
    ogType: 'article',
  },
  'case/scope/index.html': {
    title: null,
    description: null,
    h1: null,
    canonical: '/case/scope',
    ogType: 'article',
  },
  'case/wizleap/index.html': {
    title: null,
    description: null,
    h1: null,
    canonical: '/case/wizleap',
    ogType: 'article',
  },
};

// Organization 構造化データ
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TANP for Business",
  "url": "https://business.tanp.jp",
  "logo": "https://storage.googleapis.com/production-os-assets/assets/4d540b83-fe6b-41b1-a59f-96fec9ddc889",
  "description": "法人・団体向けギフトサービス。周年記念品、永年勤続表彰、お中元、誕生日ギフトなど、シーンに合わせたギフトをご提案。",
  "parentOrganization": {
    "@type": "Organization",
    "name": "TANP Inc.",
    "url": "https://tanp.jp"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "url": "https://business.tanp.jp/contact"
  }
};

function generateWebPageSchema(seo, pagePath) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": seo.title,
    "description": seo.description,
    "url": SITE_URL + (pagePath === '/' ? '' : pagePath),
    "isPartOf": {
      "@type": "WebSite",
      "name": "TANP for Business",
      "url": SITE_URL
    }
  };
}

function generateFaqSchema(faqItems) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };
}

/**
 * Extract FAQ Q&A from HTML
 */
function extractFaqItems(html) {
  const items = [];
  // Find toggle button texts (questions) and their answer panels
  const toggleRegex = /id="studio-toggle-button-([^"]+)"[^>]*>[\s\S]*?<[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)</g;
  let match;
  const questions = [];
  while ((match = toggleRegex.exec(html)) !== null) {
    const q = match[2].trim();
    if (q && q.length > 5 && !questions.includes(q)) {
      questions.push(q);
    }
  }

  // Simplified: extract text after Q. markers
  const qMarkerRegex = />Q\.<\/[^>]+>[\s\S]*?<[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)/g;
  while ((match = qMarkerRegex.exec(html)) !== null) {
    const q = match[1].trim();
    if (q && q.length > 5 && !items.find(i => i.question === q)) {
      items.push({ question: q, answer: '詳しくはお問い合わせください。' });
    }
  }

  if (items.length === 0) {
    // Fallback: use questions from toggle buttons
    for (const q of questions) {
      if (q.endsWith('？') || q.endsWith('?')) {
        items.push({ question: q, answer: '詳しくはお問い合わせください。' });
      }
    }
  }

  return items;
}

/**
 * Add alt attributes to images
 */
function addImageAlts(html, pageName) {
  let imgIndex = 0;
  return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    // Skip if already has meaningful alt
    if (/alt="[^"]+"/i.test(attrs)) return match;
    // Skip if has alt="" (decorative)
    if (/alt=""/i.test(attrs)) return match;

    imgIndex++;
    // Try to get context from nearby text or src
    let altText = `${pageName} - 画像${imgIndex}`;

    // If no alt at all, add one
    if (!/alt=/i.test(attrs)) {
      return `<img${attrs} alt="${altText}">`;
    }

    return match;
  });
}

function processPage(filePath, seoConfig) {
  let html = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(OUTPUT_DIR, filePath);
  const pageName = seoConfig.title || 'TANP for Business';

  console.log(`\n[${relPath}]`);

  // 1. Update title
  if (seoConfig.title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${seoConfig.title}</title>`);
    console.log(`  ✓ title updated`);
  }

  // 2. Update meta description
  if (seoConfig.description) {
    html = html.replace(
      /(<meta\s+(?:name="description"\s+content="|property="og:description"\s+content="))([^"]*)/gi,
      (match, prefix) => {
        if (prefix.includes('og:description')) {
          return prefix + seoConfig.description;
        }
        return prefix + seoConfig.description;
      }
    );
    console.log(`  ✓ meta description updated`);
  }

  // 3. Update OG title
  if (seoConfig.title) {
    html = html.replace(
      /(property="og:title"\s+content=")[^"]*/,
      `$1${seoConfig.title}`
    );
  }

  // 4. Fix canonical to point to business.tanp.jp
  const canonicalUrl = SITE_URL + seoConfig.canonical;
  if (html.includes('rel="canonical"')) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*/,
      `$1${canonicalUrl}`
    );
  } else {
    html = html.replace('</head>', `<link rel="canonical" href="${canonicalUrl}">\n</head>`);
  }
  console.log(`  ✓ canonical: ${canonicalUrl}`);

  // 5. Add noindex if needed
  if (seoConfig.noindex) {
    if (!html.includes('noindex')) {
      html = html.replace(
        /<meta\s+name="robots"\s+content="[^"]*"/,
        '<meta name="robots" content="noindex, nofollow"'
      );
      console.log(`  ✓ noindex added`);
    }
  }

  // 6. Add H1 tag if missing
  if (seoConfig.h1) {
    if (!/<h1[\s>]/i.test(html)) {
      // Find the first main content area - insert H1 after the header/nav section
      // Look for the StudioCanvas or main content div
      const insertH1 = `<h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">${seoConfig.h1}</h1>`;

      // Try to insert after the nav/header area
      if (html.includes('class="StudioCanvas"')) {
        html = html.replace('class="StudioCanvas"', `class="StudioCanvas">${insertH1}<!--`);
        html = html.replace(`${insertH1}<!--`, `${insertH1}`);
        // Simpler: insert right after body
      }

      // Fallback: insert after <body> or first visible content area
      if (!/<h1[\s>]/i.test(html)) {
        html = html.replace(/<body[^>]*>/, `$&\n${insertH1}`);
      }
      console.log(`  ✓ H1 added: "${seoConfig.h1}"`);
    } else {
      console.log(`  - H1 already exists`);
    }
  }

  // 7. Add image alt attributes
  const beforeImgCount = (html.match(/<img(?![^>]*alt=)/gi) || []).length;
  html = addImageAlts(html, pageName.replace(/ \| TANP for Business$/, ''));
  const afterImgCount = (html.match(/<img(?![^>]*alt=)/gi) || []).length;
  if (beforeImgCount > afterImgCount) {
    console.log(`  ✓ alt attributes added to ${beforeImgCount - afterImgCount} images`);
  }

  // 8. Add structured data
  const schemas = [];

  // Organization (only on homepage)
  if (relPath === 'index.html') {
    schemas.push(ORGANIZATION_SCHEMA);
  }

  // WebPage schema
  if (seoConfig.title && seoConfig.description) {
    schemas.push(generateWebPageSchema(seoConfig, seoConfig.canonical));
  }

  // FAQPage schema
  if (seoConfig.hasFaq) {
    const faqItems = extractFaqItems(html);
    if (faqItems.length > 0) {
      schemas.push(generateFaqSchema(faqItems));
      console.log(`  ✓ FAQPage schema: ${faqItems.length} Q&As`);
    }
  }

  if (schemas.length > 0) {
    // Remove existing schema scripts if any
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    const schemaScripts = schemas.map(s =>
      `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`
    ).join('\n');

    html = html.replace('</head>', `${schemaScripts}\n</head>`);
    console.log(`  ✓ ${schemas.length} structured data schema(s) added`);
  }

  fs.writeFileSync(filePath, html);
}

function main() {
  console.log('=== TANP for Business SEO Fix ===\n');

  for (const [file, seo] of Object.entries(PAGE_SEO)) {
    const filePath = path.join(OUTPUT_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${file} (not found)`);
      continue;
    }
    processPage(filePath, seo);
  }

  // Create sitemap.xml
  createSitemap();

  console.log('\n\n=== SEO Fix Complete ===');
}

function createSitemap() {
  const now = new Date().toISOString().split('T')[0];
  const urls = Object.entries(PAGE_SEO)
    .filter(([_, seo]) => !seo.noindex)
    .map(([file, seo]) => {
      const priority = file === 'index.html' ? '1.0' :
        file.startsWith('service/') ? '0.8' :
        file.startsWith('scene/') ? '0.8' :
        file.startsWith('case/') ? '0.7' :
        '0.5';
      return `  <url>
    <loc>${SITE_URL}${seo.canonical}</loc>
    <lastmod>${now}</lastmod>
    <priority>${priority}</priority>
  </url>`;
    });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemap);
  console.log(`\n✓ sitemap.xml created (${urls.length} URLs)`);
}

main();
