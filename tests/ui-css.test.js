// @ts-check
// The app hides buttons with the `hidden` attribute. Any class that sets `display`
// (like .btn) overrides it unless the stylesheet makes [hidden] win.
// Found while verifying v1.0.0: "Next level" showed on the last level and
// "Show solution" showed (with level 1's answer) in the sandbox.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('[hidden] always wins over component display rules', () => {
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
});

test('the sandbox does not keep the previous level solution', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const sandboxBranch = app.slice(app.indexOf("els.title.textContent = tr('sandbox')"));
  assert.match(sandboxBranch.slice(0, 600), /renderChips\(els\.solution, \[\]\)/);
});
