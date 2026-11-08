// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Repo, repoFrom, tokenize } from '../src/engine.js';

test('tokenize keeps quoted text together', () => {
  assert.deepEqual(tokenize('git commit -m "fix the login bug"'), ['git', 'commit', '-m', 'fix the login bug']);
});

test('a new repo has one commit on main', () => {
  const r = new Repo();
  assert.equal(r.headCommit(), 'C0');
  assert.equal(r.currentBranch(), 'main');
});

test('commit moves the current branch forward', () => {
  const r = repoFrom(['git commit', 'git commit -m "second"']);
  assert.equal(r.state.branches.main, 'C2');
  assert.deepEqual(r.commit('C2').parents, ['C1']);
  assert.equal(r.commit('C2').msg, 'second');
});

test('switch -c creates a branch and moves HEAD onto it', () => {
  const r = repoFrom(['git switch -c feature', 'git commit']);
  assert.equal(r.currentBranch(), 'feature');
  assert.equal(r.state.branches.feature, 'C1');
  assert.equal(r.state.branches.main, 'C0');
});

test('merge creates a merge commit with two parents', () => {
  const r = repoFrom(['git switch -c bugfix', 'git commit', 'git switch main', 'git commit', 'git merge bugfix']);
  const tip = r.commit(r.state.branches.main);
  assert.deepEqual(tip.parents, ['C2', 'C1']);
});

test('merge fast-forwards when possible, unless --no-ff', () => {
  const ff = repoFrom(['git switch -c f', 'git commit', 'git switch main', 'git merge f']);
  assert.equal(ff.state.branches.main, 'C1');
  const noff = repoFrom(['git switch -c f', 'git commit', 'git switch main', 'git merge --no-ff f']);
  assert.equal(noff.commit(noff.state.branches.main).parents.length, 2);
});

test('merging something already included does nothing', () => {
  const r = repoFrom(['git commit']);
  const res = r.run('git merge C0');
  assert.ok(res.ok);
  assert.equal(r.state.branches.main, 'C1');
});

test('rebase copies commits on top of the target', () => {
  const r = repoFrom(['git switch -c feature', 'git commit', 'git commit', 'git switch main', 'git commit', 'git switch feature', 'git rebase main']);
  assert.equal(r.state.branches.feature, "C2'");
  assert.deepEqual(r.commit("C1'").parents, ['C3']);
  assert.equal(r.commit("C1'").copyOf, 'C1');
  assert.ok(r.isAncestor('C3', r.state.branches.feature));
});

test('rebase fast-forwards when the branch is behind', () => {
  const r = repoFrom(['git branch old', 'git commit', 'git switch old', 'git rebase main']);
  assert.equal(r.state.branches.old, 'C1');
});

test('relative refs: ~ and ^', () => {
  const r = repoFrom(['git commit', 'git commit', 'git commit']);
  assert.equal(r.resolve('main~2'), 'C1');
  assert.equal(r.resolve('HEAD^'), 'C2');
  assert.equal(r.resolve('main^^'), 'C1');
  assert.equal(r.resolve('c3'), 'C3');
  const m = repoFrom(['git switch -c b', 'git commit', 'git switch main', 'git commit', 'git merge b']);
  assert.equal(m.resolve('HEAD^2'), 'C1');
});

test('checkout a commit detaches HEAD', () => {
  const r = repoFrom(['git commit', 'git checkout C0']);
  assert.equal(r.currentBranch(), null);
  assert.equal(r.headCommit(), 'C0');
  r.run('git commit');
  assert.equal(r.state.branches.main, 'C1', 'main did not move');
});

test('switch refuses a commit without --detach', () => {
  const r = repoFrom(['git commit']);
  const res = r.run('git switch C0');
  assert.equal(res.ok, false);
  assert.match(res.output, /--detach/);
});

test('reset moves the branch back; revert adds an undo commit', () => {
  const r = repoFrom(['git commit', 'git commit', 'git reset HEAD~1']);
  assert.equal(r.state.branches.main, 'C1');
  r.run('git revert C1');
  const tip = r.commit(r.state.branches.main);
  assert.equal(tip.revertOf, 'C1');
  assert.deepEqual(tip.parents, ['C1']);
});

test('cherry-pick copies chosen commits', () => {
  const r = repoFrom(['git switch -c exp', 'git commit', 'git commit', 'git commit', 'git switch main', 'git cherry-pick C1 C3']);
  assert.equal(r.state.branches.main, "C3'");
  assert.deepEqual(r.commit("C3'").parents, ["C1'"]);
  assert.equal(r.run('git cherry-pick C0').ok, false);
});

test('tags point at commits and do not move', () => {
  const r = repoFrom(['git tag v1', 'git commit']);
  assert.equal(r.state.tags.v1, 'C0');
  assert.equal(r.run('git tag v1').ok, false);
});

test('commit --amend replaces the last commit', () => {
  const r = repoFrom(['git commit -m "typo"', 'git commit --amend -m "fixed"']);
  assert.equal(r.state.branches.main, "C1'");
  assert.deepEqual(r.commit("C1'").parents, ['C0']);
  assert.equal(r.reachable().has('C1'), false);
});

test('branch -d and -f', () => {
  const r = repoFrom(['git branch tmp', 'git commit', 'git branch -f tmp main', 'git branch -d tmp']);
  assert.equal('tmp' in r.state.branches, false);
  assert.equal(r.run('git branch -d main').ok, false);
});

test('errors are friendly and leave the repo untouched', () => {
  const r = repoFrom(['git commit']);
  const before = JSON.stringify(r.state);
  for (const bad of ['commit', 'git', 'git push', 'git merge nope', 'git branch HEAD', 'git reset main~9', 'git cherry-pick C0 C1']) {
    const res = r.run(bad);
    assert.equal(res.ok, false, bad);
    assert.ok(res.output.length > 0, bad);
  }
  assert.equal(JSON.stringify(r.state), before);
});

test('messages come in Spanish when asked', () => {
  const r = new Repo(undefined, 'es');
  assert.match(r.run('git merge nada').output, /No encuentro/);
});

test('log shows decorations', () => {
  const r = repoFrom(['git commit -m "hello"', 'git tag v1']);
  assert.match(r.run('git log').output, /C1 \(HEAD -> main, tag: v1\) hello/);
});
