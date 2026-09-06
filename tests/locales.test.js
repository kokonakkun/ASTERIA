const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/renderer/locales');
const { normalizeState } = require('../src/store');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');

test('ASTERIA 4.5 exposes eleven offline language packs plus system detection', () => {
  assert.equal(i18n.supportedLocales.length, 11);
  assert.deepEqual(i18n.supportedLocales, ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de', 'pt-BR', 'hi', 'ar']);
  assert.equal(i18n.localeDefinitions.length, 12);
  assert.match(html, /id="settingLocale"/);
  assert.equal((html.match(/<option value="(?:system|ja|en|zh-CN|zh-TW|ko|es|fr|de|pt-BR|hi|ar)"/g) || []).length, 12);
  assert.match(html, /<script src="locales\.js"><\/script>\s*<script src="app\.js"><\/script>/);
});

test('locale normalization handles regional aliases and safe fallback', () => {
  assert.equal(i18n.normalizeLocale('zh-Hant-HK'), 'zh-TW');
  assert.equal(i18n.normalizeLocale('zh-SG'), 'zh-CN');
  assert.equal(i18n.normalizeLocale('pt-PT'), 'pt-BR');
  assert.equal(i18n.normalizeLocale('es-MX'), 'es');
  assert.equal(i18n.normalizeLocale('unknown'), 'en');
  assert.equal(i18n.systemLocale(['xx', 'de-DE']), 'en');
});

test('core interface terms are translated and Arabic enables RTL metadata', () => {
  i18n.setLocale('en');
  assert.equal(i18n.t('設定'), 'Settings');
  assert.equal(i18n.t('ミッションを追加'), 'Add mission');
  i18n.setLocale('zh-CN');
  assert.equal(i18n.t('データを書き出す'), '导出数据');
  i18n.setLocale('ar');
  assert.equal(i18n.t('集中'), 'التركيز');
  assert.equal(i18n.isRtl(), true);
  i18n.setLocale('ja');
  assert.equal(i18n.isRtl(), false);
});

test('version 8 persists valid locales and repairs unknown values', () => {
  assert.equal(normalizeState({ version: 7, settings: { locale: 'fr' }, tasks: [] }).settings.locale, 'fr');
  assert.equal(normalizeState({ version: 7, settings: { locale: 'xx' }, tasks: [] }).settings.locale, 'system');
});
