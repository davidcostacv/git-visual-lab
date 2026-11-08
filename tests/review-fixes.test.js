// @ts-check
// Regression tests for issues found in code review. Each test failed before its fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoFrom } from '../src/engine.js';
import { LEVELS, isComplete } from '../src/levels.js';
import { computeLayout } from '../src/layout.js';

/** @param {string} id */
const level = (id) => {
  const lv = LEVELS.find((l) => l.id === id);
  assert.ok(lv);
  return lv;
};

test('rebase level cannot be passed by throwing the work away', () => {
  const lv = level('rebase');
  assert.equal(isComplete(lv, repoFrom([...lv.setup, 'git switch feature', 'git reset main'])), false);
});

test('final level needs 2 commits of the feature itself', () => {
  const lv = level('final');
  const one = repoFrom([...lv.setup, 'git switch -c feature/login', 'git commit', 'git switch main', 'git merge --no-ff feature/login', 'git tag v1.0']);
  assert.equal(isComplete(lv, one), false);
});

test('names like "constructor" are not treated as existing branches', () => {
  const r = repoFrom(['git commit']);
  assert.equal(r.run('git checkout constructor').ok, false);
  assert.equal(r.run('git branch x toString').ok, false);
  assert.equal(r.run('git branch constructor').ok, true);
  assert.equal(r.run('git commit').ok, true, 'repo still works');
});

test('git log shows commits from merged branches too', () => {
  const r = repoFrom(['git switch -c f', 'git commit -m F1', 'git switch main', 'git commit -m M1', 'git merge f']);
  const out = r.run('git log --oneline').output;
  assert.match(out, /F1/);
  assert.match(out, /M1/);
  assert.match(r.run('git log f').output, /^C1/);
});

test('branch -d refuses unmerged work, -D forces', () => {
  const r = repoFrom(['git switch -c f', 'git commit', 'git switch main']);
  assert.equal(r.run('git branch -d f').ok, false);
  assert.equal(r.run('git branch -D f').ok, true);
});

test('rebase skips commits already on the base (cherry-picked)', () => {
  const r = repoFrom(['git switch -c feature', 'git commit -m F1', 'git commit -m F2', 'git switch main', 'git commit -m M1', 'git cherry-pick C2', 'git switch feature', 'git rebase main']);
  const tip = r.commit(r.state.branches.feature);
  assert.equal(tip.copyOf, 'C1', 'only F1 is copied');
  assert.deepEqual(tip.parents, [r.state.branches.main]);
});

test('revert refuses merge commits; --no-edit and -x are accepted', () => {
  const r = repoFrom(['git switch -c f', 'git commit', 'git switch main', 'git commit', 'git merge f']);
  assert.equal(r.run('git revert HEAD').ok, false);
  assert.equal(r.run('git revert --no-edit C2').ok, true);
  const p = repoFrom(['git switch -c f', 'git commit', 'git switch main']);
  assert.equal(p.run('git cherry-pick -x C1').ok, true);
});

test('tags win over branches with the same name, like real git', () => {
  const r = repoFrom(['git commit', 'git tag x', 'git commit', 'git branch x']);
  assert.equal(r.resolve('x'), 'C1');
});

test('checkout -B resets an existing branch', () => {
  const r = repoFrom(['git branch f', 'git commit', 'git checkout -B f']);
  assert.equal(r.state.branches.f, 'C1');
  assert.equal(r.currentBranch(), 'f');
});

test('long labels on neighbouring commits do not overlap', () => {
  const r = repoFrom(['git switch -c feature/login-form', 'git commit', 'git tag release-candidate-1', 'git commit']);
  const { labels } = computeLayout(r);
  for (const a of labels) {
    for (const b of labels) {
      if (a === b) continue;
      const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
      const overlapY = Math.abs(a.y - b.y) < 22;
      assert.ok(!(overlapX && overlapY), `${a.text} overlaps ${b.text}`);
    }
  }
});
