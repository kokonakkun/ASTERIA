const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
const locales = fs.readFileSync(path.join(root, 'docs', 'locales.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'docs', 'app.js'), 'utf8');

test('official site presents ASTERIA 4.5 and loads localization before behavior', () => {
  assert.match(html, /ASTERIA 4\.5/);
  assert.doesNotMatch(html, /ASTERIA 4\.0/);
  assert.match(html, /<script src="locales\.js" defer><\/script>\s*<script src="app\.js" defer><\/script>/);
  assert.match(html, /data-locale-select/);
  assert.match(html, /GLOBAL LANGUAGE UPDATE/);
});

test('official site exposes the same eleven locale identifiers and privacy promise', () => {
  for (const locale of ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de', 'pt-BR', 'hi', 'ar']) {
    assert.match(locales, new RegExp(`['"]${locale.replace('-', '\\-')}['"]`));
  }
  assert.match(html, /11言語/);
  assert.match(html, /外部の翻訳サービスへ送信しません/);
  assert.match(locales, /document\.documentElement\.dir/);
  assert.match(locales, /'製品情報': 'Product information'/);
  assert.match(app, /asteria-site-locale/);
});
