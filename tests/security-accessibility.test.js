const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

test('renderer is isolated, sandboxed, and denied arbitrary navigation', () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(main, /will-navigate/);
});

test('content security policy keeps ASTERIA offline by default', () => {
  const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /connect-src 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /https?:/);
});

test('file exchange is bounded and supports only explicit extensions', () => {
  assert.match(main, /20 \* 1024 \* 1024/);
  assert.match(main, /extensions: \['json', 'csv', 'ics', 'md', 'markdown', 'txt'\]/);
});

test('all forms presented as dialogs expose modal semantics and labels', () => {
  const forms = [...html.matchAll(/<form class="modal[^"]*"[^>]+>/g)].map((match) => match[0]);
  assert.equal(forms.length, 8);
  for (const form of forms) {
    assert.match(form, /role="dialog"/);
    assert.match(form, /aria-modal="true"/);
    assert.match(form, /aria-labelledby="[^"]+"/);
  }
  assert.match(html, /class="command-box" role="dialog" aria-modal="true" aria-label=/);
});

test('NEXUS tabs, motion preferences, and live feedback are exposed semantically', () => {
  assert.match(html, /id="nexusTabs" role="tablist"/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.match(html, /id="toastRegion" aria-live="polite"/);
  assert.match(html, /id="settingReducedMotion"/);
});
