// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoFrom } from '../src/engine.js';
import { LEVELS, goalStatus, isComplete, commandsFor } from '../src/levels.js';

/** @param {import('../src/levels.js').Level} l */
const setup = (l, lang = /** @type {'en' | 'es'} */ ('en')) => commandsFor(l, 'setup', lang);
/** @param {import('../src/levels.js').Level} l */
const solution = (l, lang = /** @type {'en' | 'es'} */ ('en')) => commandsFor(l, 'solution', lang);
import { computeLayout, toSvgString } from '../src/layout.js';

for (const [i, level] of LEVELS.entries()) {
  test(`level ${i + 1} (${level.id}): starts unsolved`, () => {
    const repo = repoFrom(setup(level));
    assert.equal(isComplete(level, repo), false, 'a level must not be solved before you play');
  });

  test(`level ${i + 1} (${level.id}): the solution solves it`, () => {
    const repo = repoFrom([...setup(level), ...solution(level)]);
    assert.deepEqual(goalStatus(level, repo), level.goals.map(() => true));
  });

  test(`level ${i + 1} (${level.id}): every text exists in English and Spanish`, () => {
    for (const text of [level.title, level.lesson, level.real, ...level.goals.map((g) => g.text)]) {
      assert.ok(text.en.trim().length > 0);
      assert.ok(text.es.trim().length > 0);
    }
  });

  test(`level ${i + 1} (${level.id}): graph renders without overlaps`, () => {
    const layout = computeLayout(repoFrom([...setup(level), ...solution(level)]));
    const seen = new Set(layout.nodes.map((n) => `${n.x},${n.y}`));
    assert.equal(seen.size, layout.nodes.length, 'two commits drawn on the same spot');
    assert.match(toSvgString(layout), /^<svg/);
  });
}

test('wrong answers do not pass', () => {
  const merge = LEVELS.find((l) => l.id === 'merge');
  assert.ok(merge);
  // rebasing instead of merging leaves main without a merge commit
  const repo = repoFrom([...setup(merge), 'git switch bugfix', 'git rebase main', 'git switch main', 'git merge bugfix']);
  assert.equal(isComplete(merge, repo), false);

  const pick = LEVELS.find((l) => l.id === 'cherry-pick');
  assert.ok(pick);
  const all = repoFrom([...setup(pick), 'git merge experiments']);
  assert.equal(isComplete(pick, all), false, 'merging everything also brings the weird test C3');
});
