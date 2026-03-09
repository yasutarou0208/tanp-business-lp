# TANP for Business — GitHub Pages 静的サイト移行

**公開URL**: https://yasutarou0208.github.io/tanp-business-lp/
**元サイト**: https://business.tanp.jp/
**移行日**: 2026-03-09

---

## 概要

business.tanp.jp（Nuxt.js SPA）の全15ページを、GitHub Pages 上の静的HTMLとして再現したプロジェクト。元サイトのSEO監査で判明した技術的課題（H1欠如、canonical未設定、SPA依存によるクローラビリティ問題等）を、静的HTML化の過程で同時に解決している。

---

## 1. 移行作業

### 1.1 アプローチ

Playwright で各ページにアクセスし、CDP（Chrome DevTools Protocol）の `Page.captureSnapshot` で MHTML 形式のスナップショットを取得。MHTML をパースして単一の自己完結型 HTML に変換する方式を採用した。

### 1.2 変換パイプライン（`scripts/batch_pipeline_v2.js`）

1. **MHTML取得** — Playwright で `networkidle` まで待機後、CDPでMHTMLスナップショットを取得
2. **MHTMLパース** — boundary で分割し、各パーツの Content-Type / Content-Location / Content-Transfer-Encoding を解析
3. **cid: CSS解決** — Blink が生成する `cid:css-xxx@mhtml.blink` 参照を Content-Location で照合し、`<link>` を `<style>` タグにインライン化
4. **cid: iframe解決** — `cid:frame-xxx` を元のURL（form.run等）に復元
5. **画像Base64埋め込み** — storage.googleapis.com 等の画像をMHTMLパーツからBase64 data URI に変換
6. **UTF-8 quoted-printable対応** — マルチバイト文字（日本語）のバイト列を正しくUTF-8デコード
7. **@font-face除去** — MHTMLに含まれるフォントバイナリを除去し、Google Fonts CDN リンクに置換
8. **Material Icons追加** — Material Symbols Outlined / Material Icons のCDNリンクを追加
9. **Nuxtランタイム除去** — `_nuxt/*.js` スクリプトと modulepreload リンクを削除
10. **内部リンク変換** — `https://business.tanp.jp/xxx` → `/tanp-business-lp/xxx/` に一括変換
11. **FAQアコーディオン修正** — Nuxt.js のランタイムが無くなることで動作しなくなるFAQトグルを、Vanilla JS で再実装して `</body>` 前に注入

### 1.3 対象ページ（15ページ）

| # | パス | サイズ | 備考 |
|---|------|--------|------|
| 1 | `/` | 1,004 KB | トップページ。FAQ 11問あり |
| 2 | `/contact` | 56 KB | form.run iframe 埋め込み |
| 3 | `/contact/complete` | 68 KB | サンクスページ（noindex） |
| 4 | `/contact/download` | 68 KB | 資料DL form.run iframe |
| 5 | `/service/ticket` | 1,452 KB | TANP Ticket サービス紹介 |
| 6 | `/service/birthday` | 2,352 KB | 誕生日ギフト |
| 7 | `/service/souvenir` | 2,672 KB | 引菓子・ノベルティ |
| 8 | `/scene/corporate-anniversary` | 2,328 KB | 周年記念品 |
| 9 | `/scene/graduation` | 1,060 KB | 卒業記念品 |
| 10 | `/scene/long-service` | 2,052 KB | 永年勤続記念品 |
| 11 | `/scene/summer-gift` | 4,268 KB | お中元 |
| 12 | `/case/EE6MsV9k` | 104 KB | 導入事例: ジェイテクト |
| 13 | `/case/funds` | 448 KB | 導入事例: ファンズ |
| 14 | `/case/scope` | 848 KB | 導入事例: スコープ |
| 15 | `/case/wizleap` | 488 KB | 導入事例: Wizleap |

**合計: 約19 MB**（GitHub Pages 1GB制限内）

### 1.4 移行で解決した技術課題

| 課題 | 原因 | 解決方法 |
|------|------|----------|
| CSS未適用 | MHTML内のcid:参照が解決できない | Content-Locationマッピングでインライン化 |
| 日本語文字化け | quoted-printableのバイト列をLatin-1として処理 | バイト配列→Buffer→UTF-8デコードに修正 |
| アイコン文字列表示 | Material Icons フォント未読み込み | Google Fonts CDN リンクを追加 |
| FAQアコーディオン動作不良 | Nuxt.jsランタイム除去で機能喪失 | `_isClose` クラストグル + `aria-expanded` 切替の Vanilla JS を注入 |
| iframe空白表示 | form.run のcid:参照 | 実URLに復元（GitHub Pages上で正常動作） |
| SEO H1挿入によるHTML破損 | StudioCanvas要素の属性が断片化 | `aria-hidden="false">` テキスト漏れを除去 |

### 1.5 品質検証

- **デスクトップ検証**: Playwright (1440×900) で全15ページのフルページスクリーンショットを取得・目視確認
- **モバイル検証**: Playwright iPhone 14 デバイスエミュレーションで全15ページのスクリーンショットを取得・目視確認
- **FAQ動作検証**: FAQトグルボタンのクリック後に `_isClose` クラス除去・`aria-expanded="true"` 設定を自動テストで確認

---

## 2. SEO最適化

[SEO監査レポート](../リサーチ/TANP%20for%20Business%20SEO監査/SEO監査レポート.md) の優先アクションプランに基づき、Phase 1（Critical）と Phase 2（High Impact）の全項目を実装した。

### 2.1 Phase 1: Critical — 即対応項目

#### H1タグ設置（全15ページ）

元サイトでは全ページで `<h1>` タグが欠如（Nuxt.jsコンポーネント内でビジュアル的には見出しがあるが、セマンティックHTMLとして出力されていない）。

| ページ | 設定したH1 |
|--------|-----------|
| トップ | 法人向けギフト・おまとめ注文サービス TANP for Business |
| お問い合わせ | お問い合わせ・ご相談 |
| お問い合わせ完了 | お問い合わせありがとうございます |
| 資料DL | 資料ダウンロード |
| TANP Ticket | TANP Ticket（元サイトのH1を活用） |
| 誕生日ギフト | 従業員向け誕生日ギフト |
| 引菓子 | 全国の拠点から、いつでも統一された手土産を。（元サイトのH1を活用） |
| 周年記念 | 周年記念品・創立記念ギフト特集 |
| 卒業記念 | 卒業記念品・卒園記念品ギフト特集 |
| 永年勤続 | 永年勤続表彰 記念品・報奨ギフト |
| お中元 | 法人向けお中元ギフト・夏の贈り物特集 |
| 導入事例4件 | 各事例の既存タイトルをH1として活用 |

※ ビジュアルに影響を与えないよう、新規追加H1はCSSで visually-hidden（`clip:rect(0,0,0,0)` 等）を適用。

#### canonicalタグ設定（全15ページ）

全ページに `business.tanp.jp` 向けの self-referencing canonical を設定。

```html
<link rel="canonical" href="https://business.tanp.jp/scene/summer-gift">
```

#### title / meta description 個別化

元サイトでは `service/birthday`、`service/souvenir` のtitle・descriptionがトップページと完全に重複していた。各ページ固有のキーワードを含むtitle・descriptionに変更。

**修正前（重複）:**
```
title: おまとめ注文・法人のお客様向けギフト | TANP for Business  ← 3ページで共通
```

**修正後（個別化）:**
```
トップ:    法人向けギフト・おまとめ注文 | TANP for Business
誕生日:    従業員向け誕生日ギフト・福利厚生ギフト | TANP for Business
引菓子:    引菓子・ノベルティギフト | TANP for Business
お中元:    法人向けお中元ギフト・夏の贈り物特集 | TANP for Business
周年記念:  周年記念品・創立記念ギフト特集 | TANP for Business
...（全ページ個別化）
```

#### noindex 設定

`/contact/complete`（サンクスページ）に `<meta name="robots" content="noindex, nofollow">` を設定。

### 2.2 Phase 2: High Impact

#### 画像alt属性

alt属性が未設定だった画像にalt属性を追加。

#### sitemap.xml 作成

```
sitemap.xml（14ページ、lastmod付き）
├── / (priority: 1.0)
├── /service/* (priority: 0.8)
├── /scene/* (priority: 0.8)
├── /case/* (priority: 0.7)
├── /contact, /contact/download (priority: 0.5)
└── /contact/complete は除外（noindex）
```

#### robots.txt 作成

```
User-agent: *
Allow: /
Sitemap: https://business.tanp.jp/sitemap.xml
Disallow: /contact/complete
```

#### 構造化データ（JSON-LD）

| ページ | スキーマ |
|--------|---------|
| トップ | Organization + WebPage + FAQPage（11問） |
| サービス系 3ページ | WebPage |
| シーン系（周年・勤続・お中元） | WebPage + FAQPage（各5問） |
| シーン系（卒業） | WebPage |
| 導入事例 4ページ | Article |
| お問い合わせ系 3ページ | WebPage |

**FAQPage スキーマの例（トップページ、11問）:**
- 1,000個以上でも対応できますか？
- 会社（団体）のロゴの刻印は可能でしょうか？
- 全国に送れますか？
- 支払い方法は何がありますか？
- 見積書、領収書は発行できますか？
- キャンペーンの景品として商品を購入することは可能ですか？
- 最低注文金額はありますか？
- 納期はどれくらいですか？
- 会社でなくても問い合わせ可能ですか？
- ラッピングの持込みは可能ですか？
  ...等

### 2.3 未実装（Phase 3-4）

以下は静的HTML化では対応できず、コンテンツ制作・運用体制が必要な項目。

| 項目 | 内容 |
|------|------|
| コンテンツ拡充 | シーン別ページに「選び方」「相場」「マナー」等のガイドコンテンツを追加 |
| FAQ専用ページ | FAQPageとして独立ページを作成 |
| 導入事例拡充 | 現在5件 → 業種・シーン別に20件以上 |
| ブログ/オウンドメディア | 「法人ギフト 選び方」等のキーワードを狙うコンテンツマーケティング |
| 内部リンク強化 | tanp.jp 本体からのリンク設置 |
| 被リンク獲得 | PR・外部メディア施策 |
| Core Web Vitals | PageSpeed Insights での計測・最適化 |

---

## 3. ディレクトリ構成

```
tanp-business-lp/
├── index.html                          # トップページ
├── contact/
│   ├── index.html                      # お問い合わせ
│   ├── complete/index.html             # お問い合わせ完了（noindex）
│   └── download/index.html             # 資料ダウンロード
├── service/
│   ├── ticket/index.html               # TANP Ticket
│   ├── birthday/index.html             # 誕生日ギフト
│   └── souvenir/index.html             # 引菓子・ノベルティ
├── scene/
│   ├── corporate-anniversary/index.html # 周年記念品
│   ├── graduation/index.html           # 卒業記念品
│   ├── long-service/index.html         # 永年勤続
│   └── summer-gift/index.html          # お中元
├── case/
│   ├── EE6MsV9k/index.html            # 事例: ジェイテクト
│   ├── funds/index.html                # 事例: ファンズ
│   ├── scope/index.html                # 事例: スコープ
│   └── wizleap/index.html              # 事例: Wizleap
├── sitemap.xml                         # XMLサイトマップ
├── robots.txt                          # robots.txt
├── .gitignore
└── scripts/
    ├── batch_pipeline.js               # v1 パイプライン（初期版）
    ├── batch_pipeline_v2.js            # v2 パイプライン（cid:解決対応）
    ├── fix_existing_index.js           # 既存index.htmlへのリンク変換・FAQ修正
    ├── verify_pages.js                 # ページ品質チェック
    ├── screenshot_test.js              # デスクトップスクリーンショットテスト
    ├── mobile_test.js                  # モバイルスクリーンショットテスト
    ├── seo_fix.js                      # SEO一括修正メイン
    ├── seo_fix_h1.js                   # H1タグ修正
    ├── seo_fix_faq.js                  # FAQPageスキーマ追加
    └── seo_fix_final.js               # Article スキーマ + title修正
```

---

## 4. コミット履歴

| コミット | 内容 |
|---------|------|
| `c357090` | 初回: トップページのみ追加 |
| `0405809` | @font-face → Google Fonts CDN 置換、Nuxtスクリプト除去 |
| `91f45cd` | 全15ページ静的HTML生成 + FAQアコーディオン修正 |
| `1672d21` | Material Icons/Symbols フォント読み込み追加 |
| `ccb5814` | SEO監査レポートに基づく全ページSEO最適化 |
| `f793c66` | H1挿入時のaria-hidden属性テキスト漏れ修正 |
