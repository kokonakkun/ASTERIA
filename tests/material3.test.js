const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'renderer', 'material3.css'), 'utf8');

test('Material Design 3 layer is enabled by the application shell', () => {
  assert.match(html, /data-design="material3"/);
  assert.match(html, /href="material3\.css"/);
  assert.match(html, /class="version">4\.5</);
});

test('semantic color roles cover primary, surface, outline, inverse and error states', () => {
  for (const role of [
    'primary', 'on-primary', 'primary-container', 'on-primary-container',
    'surface', 'on-surface', 'surface-container-low', 'surface-container-high',
    'outline', 'outline-variant', 'inverse-surface', 'inverse-on-surface',
    'error', 'on-error'
  ]) {
    assert.match(css, new RegExp(`--md-sys-color-${role}:`), `missing ${role}`);
  }
});

test('shape and elevation scales define component hierarchy', () => {
  for (const shape of ['extra-small', 'small', 'medium', 'large', 'extra-large', 'full']) {
    assert.match(css, new RegExp(`--md-sys-shape-corner-${shape}:`), `missing ${shape}`);
  }
  for (const level of [0, 1, 2, 3, 4]) assert.match(css, new RegExp(`--md-sys-elevation-${level}:`));
});

test('navigation destinations have persistent visible labels', () => {
  const labels = [...html.matchAll(/<span class="nav-label">([^<]+)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(labels.slice(0, 8), ['ホーム', 'ミッション', 'プラン', '集中', 'ログ', 'Nexus', '連携', '分析']);
});

test('version 3 appearance, integration, and motion controls are present', () => {
  assert.match(html, /data-appearance="light"/);
  assert.match(html, /data-appearance="dark"/);
  assert.match(html, /data-appearance="system"/);
  assert.match(html, /id="settingAccentColor" type="color"/);
  assert.match(html, /id="integrationsView"/);
  assert.equal((html.match(/class="service-card panel"/g) || []).length, 6);
  assert.match(css, /--md-sys-motion-easing-emphasized:/);
  assert.match(css, /body\[data-color-scheme="light"\]/);
  assert.match(css, /@keyframes m3DialogEnter/);
});

test('version 4 NEXUS surfaces expose automation, templates, and diagnostics', () => {
  assert.match(html, /id="nexusView"/);
  assert.match(html, /data-nexus-tab="automations"/);
  assert.match(html, /data-nexus-tab="templates"/);
  assert.match(html, /data-nexus-tab="health"/);
  assert.match(html, /id="automationModal"/);
  assert.match(html, /id="templateModal"/);
  assert.match(html, /src="\.\.\/productivity-engine\.js"/);
  assert.match(css, /ASTERIA 4\.5 — NEXUS/);
});

test('version 4.5 adds locale selection and RTL-aware layout', () => {
  assert.match(html, /id="settingLocale"/);
  assert.match(html, /src="locales\.js"/);
  assert.match(css, /html\[dir="rtl"\]/);
});

test('core text and container pairs meet WCAG AA contrast', () => {
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  };
  const pairs = [
    ['#e5e1e8', '#121116'],
    ['#e5e1e8', '#1b1a1f'],
    ['#c9bfff', '#30275f'],
    ['#e7deff', '#473e75'],
    ['#79dce2', '#00363a'],
    ['#9cf0f4', '#005056'],
    ['#ffb86c', '#4b2800'],
    ['#ffdcc0', '#6b3b00'],
    ['#ffb4ab', '#690005']
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});
