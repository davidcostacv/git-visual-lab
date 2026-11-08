// @ts-check
// Commit messages follow the player's language (found while verifying v1.0.1:
// in Spanish, the graph and git log still said "Search box", "Initial commit").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoFrom } from '../src/engine.js';
import { LEVELS, COMMIT_MESSAGES, commandsFor, isComplete, localize } from '../src/levels.js';

const english = new Set(Object.values(COMMIT_MESSAGES).map((m) => m.en));
english.add('Initial commit');

for (const level of LEVELS) {
  test(`${level.id}: Spanish solution solves it and every message is Spanish`, () => {
    const repo = repoFrom([...commandsFor(level, 'setup', 'es'), ...commandsFor(level, 'solution', 'es')], 'es');
    assert.ok(isComplete(level, repo));
    for (const c of Object.values(repo.state.commits)) {
      assert.ok(!english.has(c.msg), `English message in Spanish game: ${c.msg}`);
      assert.ok(!c.msg.includes('@'), `unresolved placeholder: ${c.msg}`);
    }
  });
}

test('every command placeholder has a message in both languages', () => {
  for (const level of LEVELS) {
    for (const part of /** @type {const} */ (['setup', 'solution', 'commands'])) {
      for (const lang of /** @type {const} */ (['en', 'es'])) {
        for (const cmd of commandsFor(level, part, lang)) assert.ok(!cmd.includes('@'), cmd);
      }
    }
  }
  assert.throws(() => localize('git commit -m @nope', 'en'));
});

test('the first commit is named in the player language', () => {
  assert.equal(repoFrom([], 'es').commit('C0').msg, 'Commit inicial');
  assert.equal(repoFrom([], 'en').commit('C0').msg, 'Initial commit');
});
