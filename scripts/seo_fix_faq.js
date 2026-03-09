#!/usr/bin/env node
/**
 * FAQPage 構造化データを全FAQ付きページに追加
 */
const fs = require('fs');
const path = require('path');
const OUTPUT_DIR = path.resolve(__dirname, '..');

// トップページFAQ（手動抽出）
const TOP_FAQ = [
  { q: '1,000個以上でも対応できますか？', a: '商品によりご対応可能です。ぜひお気軽にご相談ください。' },
  { q: '会社（団体）のロゴの刻印は可能でしょうか？', a: '商品により対応可能です。ぜひお気軽にご相談ください。' },
  { q: 'タンプではロゴ入れができない商品でもロゴ入れ可能ですか？', a: '商品によりご対応可能です。まずはお気軽にご相談ください。' },
  { q: '全国に送れますか？', a: '日本全国に配送可能です。また、一回のご注文で複数箇所への配送も可能です。' },
  { q: '支払い方法は何がありますか？', a: '銀行振り込み（前払い）、クレジットカード、GMO後払い、PayPayがご利用可能です。' },
  { q: '見積書、領収書は発行できますか？', a: '発行可能です。ご希望の場合はお問い合わせください。' },
  { q: 'キャンペーンの景品として商品を購入することは可能ですか？', a: 'キャンペーンでの具体的なご利用内容をヒアリングさせていただき、ブランド様への必要なお手続き等も含めて弊社で承ります。' },
  { q: '最低注文金額はありますか？', a: 'おおよそ商品代金なども含めまして、総額10万円以上からご対応をさせていただきます。' },
  { q: '納期はどれくらいですか？', a: '商品によっては翌日お届けも可能です（※在庫状況によります）。' },
  { q: '会社でなくても問い合わせ可能ですか？', a: '個人・学校法人のお客様であってももちろん対応可能でございます。お気軽にお問い合わせください。' },
  { q: 'ラッピングの持込みは可能ですか？', a: '追加のオプション料金は発生いたしますが、対応可能です。' },
];

// シーン別ページFAQ（共通的なFAQ）
const SCENE_FAQ = [
  { q: '最小注文数はいくつからですか？', a: '最小10個からご注文いただけます。詳細はお問い合わせください。' },
  { q: '名入れやロゴ入れは可能ですか？', a: '多くの商品で名入れ・ロゴ入れに対応しております。商品により対応可否が異なりますので、お気軽にご相談ください。' },
  { q: '納期はどれくらいですか？', a: '商品や数量により異なりますが、最短で翌日発送も可能です。お急ぎの場合はご相談ください。' },
  { q: '見積もりは無料ですか？', a: 'はい、お見積もりは無料です。お気軽にお問い合わせください。' },
  { q: '全国どこでも配送可能ですか？', a: '日本全国に配送可能です。複数箇所への同時配送にも対応しております。' },
];

function buildFaqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };
}

const pages = [
  { file: 'index.html', faq: TOP_FAQ },
  { file: 'scene/corporate-anniversary/index.html', faq: SCENE_FAQ },
  { file: 'scene/long-service/index.html', faq: SCENE_FAQ },
  { file: 'scene/summer-gift/index.html', faq: SCENE_FAQ },
];

for (const page of pages) {
  const filePath = path.join(OUTPUT_DIR, page.file);
  let html = fs.readFileSync(filePath, 'utf-8');

  const schema = buildFaqSchema(page.faq);
  const schemaTag = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;

  // Insert before </head>
  html = html.replace('</head>', `${schemaTag}\n</head>`);

  fs.writeFileSync(filePath, html);
  console.log(`✓ ${page.file}: FAQPage schema added (${page.faq.length} Q&As)`);
}
