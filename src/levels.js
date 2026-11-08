// @ts-check
/**
 * The course. Each level = a short lesson + a starting repo (setup) + goals checked live.
 * `solution` is one valid answer: tests prove it completes the level, and the PDF shows it.
 */

/** @typedef {import('./engine.js').Repo} Repo */
/** @typedef {{ en: string, es: string }} Text */
/**
 * @typedef {{ text: Text, check: (r: Repo) => boolean }} Goal
 * @typedef {{
 *   id: string,
 *   title: Text,
 *   lesson: Text,
 *   real: Text,
 *   commands: string[],
 *   setup: string[],
 *   solution: string[],
 *   goals: Goal[],
 * }} Level
 */

/** Number of commits on a branch counting back along first parents. @param {Repo} r @param {string} b */
const depth = (r, b) => {
  let n = 0;
  /** @type {string | undefined} */
  let id = r.state.branches[b];
  while (id) {
    n++;
    id = r.commit(id).parents[0];
  }
  return n;
};
/** @param {Repo} r @param {string} b */
const tip = (r, b) => (b in r.state.branches ? r.commit(r.state.branches[b]) : undefined);
/** @param {Repo} r @param {string} b */
const onBranch = (r, b) => r.currentBranch() === b;
/** Does `branch` contain a copy (rebase / cherry-pick) of commit `orig`? @param {Repo} r @param {string} b @param {string} orig */
const hasCopyOf = (r, b, orig) =>
  b in r.state.branches && [...r.ancestors(r.state.branches[b])].some((id) => r.commit(id).copyOf === orig);

/** @type {Level[]} */
export const LEVELS = [
  {
    id: 'commits',
    title: { en: 'Commits: save points', es: 'Commits: puntos de guardado' },
    lesson: {
      en: '<p>A <b>commit</b> is a snapshot of your whole project at one moment, like a save point in a video game. Each new commit remembers the one before it (its <i>parent</i>), so together they form a history you can always go back to.</p><p>Each circle in the graph is a commit. <b>main</b> is the name of your branch, and <b>HEAD</b> marks where you are standing right now.</p>',
      es: '<p>Un <b>commit</b> es una foto de todo tu proyecto en un momento, como un punto de guardado en un videojuego. Cada commit nuevo recuerda al anterior (su <i>padre</i>), así que juntos forman una historia a la que siempre puedes volver.</p><p>Cada círculo del grafo es un commit. <b>main</b> es el nombre de tu rama y <b>HEAD</b> marca dónde estás parado ahora.</p>',
    },
    real: {
      en: 'In a real project you first run <code>git add file</code> to choose what goes in the snapshot, then <code>git commit -m "what I did"</code>. A good message explains <i>why</i>.',
      es: 'En un proyecto real primero corres <code>git add archivo</code> para elegir qué entra en la foto y luego <code>git commit -m "qué hice"</code>. Un buen mensaje explica el <i>porqué</i>.',
    },
    commands: ['git commit', 'git commit -m "message"'],
    setup: [],
    solution: ['git commit -m "Add homepage"', 'git commit -m "Add contact form"'],
    goals: [
      { text: { en: 'main has 2 new commits (3 in total)', es: 'main tiene 2 commits nuevos (3 en total)' }, check: (r) => depth(r, 'main') >= 3 },
      { text: { en: 'You are still on main', es: 'Sigues en main' }, check: (r) => onBranch(r, 'main') },
    ],
  },
  {
    id: 'branches',
    title: { en: 'Branches: parallel worlds', es: 'Ramas: mundos paralelos' },
    lesson: {
      en: '<p>A <b>branch</b> is just a sticky note with a name, pointing at a commit. Creating one is instant and costs nothing.</p><p>Branches let you try an idea without touching <b>main</b>. When you commit, only the branch you are on (the one HEAD is attached to) moves forward.</p>',
      es: '<p>Una <b>rama</b> es solo una notita con un nombre, pegada a un commit. Crear una es instantáneo y no cuesta nada.</p><p>Las ramas te dejan probar una idea sin tocar <b>main</b>. Cuando haces commit, solo avanza la rama en la que estás (a la que está pegado HEAD).</p>',
    },
    real: {
      en: 'Teams create one branch per feature or bug fix, for example <code>feature/login</code>. <code>git switch -c name</code> creates the branch and moves you onto it in one step.',
      es: 'Los equipos crean una rama por función o arreglo, por ejemplo <code>feature/login</code>. <code>git switch -c nombre</code> crea la rama y te mueve a ella en un solo paso.',
    },
    commands: ['git branch name', 'git switch name', 'git switch -c name'],
    setup: ['git commit'],
    solution: ['git switch -c new-feature', 'git commit'],
    goals: [
      { text: { en: 'A branch called new-feature exists', es: 'Existe una rama llamada new-feature' }, check: (r) => 'new-feature' in r.state.branches },
      { text: { en: 'You are on new-feature', es: 'Estás en new-feature' }, check: (r) => onBranch(r, 'new-feature') },
      {
        text: { en: 'new-feature has a commit that main does not have', es: 'new-feature tiene un commit que main no tiene' },
        check: (r) => 'new-feature' in r.state.branches && !r.isAncestor(r.state.branches['new-feature'], r.state.branches.main),
      },
    ],
  },
  {
    id: 'merge',
    title: { en: 'Merge: bring work together', es: 'Merge: juntar el trabajo' },
    lesson: {
      en: '<p>Your fix lives on <b>bugfix</b>, but users only get what is on <b>main</b>. <b>git merge</b> joins two histories.</p><p>Because both branches moved, Git creates a <b>merge commit</b>: a commit with <i>two parents</i>. Now main contains everything from both sides.</p>',
      es: '<p>Tu arreglo vive en <b>bugfix</b>, pero los usuarios solo reciben lo que está en <b>main</b>. <b>git merge</b> une dos historias.</p><p>Como las dos ramas avanzaron, Git crea un <b>commit de merge</b>: un commit con <i>dos padres</i>. Ahora main contiene todo lo de ambos lados.</p>',
    },
    real: {
      en: 'Stand on the branch that <i>receives</i> the work (usually main), then merge the other one into it. On GitHub, the "Merge pull request" button does exactly this.',
      es: 'Párate en la rama que <i>recibe</i> el trabajo (casi siempre main) y haz merge de la otra. En GitHub, el botón "Merge pull request" hace exactamente esto.',
    },
    commands: ['git switch main', 'git merge bugfix'],
    setup: ['git commit', 'git switch -c bugfix', 'git commit -m "Fix crash"', 'git switch main', 'git commit -m "New banner"'],
    solution: ['git merge bugfix'],
    goals: [
      { text: { en: 'main contains the bugfix work', es: 'main contiene el trabajo de bugfix' }, check: (r) => r.isAncestor(r.state.branches.bugfix, r.state.branches.main) },
      { text: { en: 'main ends in a merge commit (2 parents)', es: 'main termina en un commit de merge (2 padres)' }, check: (r) => tip(r, 'main')?.parents.length === 2 },
      { text: { en: 'You are on main', es: 'Estás en main' }, check: (r) => onBranch(r, 'main') },
    ],
  },
  {
    id: 'rebase',
    title: { en: 'Rebase: a straight line', es: 'Rebase: historia en línea recta' },
    lesson: {
      en: '<p><b>Rebase</b> is the other way to combine work. Instead of a merge commit, it <i>copies</i> your commits and replays them on top of another branch, as if you had started your work today.</p><p>Copies get a prime: <b>C2</b> becomes <b>C2\'</b>. The old ones fade away because nothing points at them anymore.</p>',
      es: '<p><b>Rebase</b> es la otra forma de combinar trabajo. En vez de un commit de merge, <i>copia</i> tus commits y los repite encima de otra rama, como si hubieras empezado tu trabajo hoy.</p><p>Las copias llevan una comilla: <b>C2</b> pasa a ser <b>C2\'</b>. Los viejos se apagan porque ya nada los apunta.</p>',
    },
    real: {
      en: 'Use rebase to update <i>your own</i> branch before opening a pull request. Golden rule: never rebase commits other people already pulled, because it rewrites history.',
      es: 'Usa rebase para actualizar <i>tu propia</i> rama antes de abrir un pull request. Regla de oro: nunca hagas rebase de commits que otras personas ya bajaron, porque reescribe la historia.',
    },
    commands: ['git switch feature', 'git rebase main'],
    setup: ['git commit', 'git switch -c feature', 'git commit -m "Search box"', 'git commit -m "Search results"', 'git switch main', 'git commit -m "Hotfix"'],
    solution: ['git switch feature', 'git rebase main'],
    goals: [
      { text: { en: 'feature sits on top of the latest main', es: 'feature queda encima del último main' }, check: (r) => 'feature' in r.state.branches && r.isAncestor(r.state.branches.main, r.state.branches.feature) },
      {
        text: { en: 'Your two search commits are still on feature (as copies)', es: 'Tus dos commits de búsqueda siguen en feature (como copias)' },
        check: (r) => hasCopyOf(r, 'feature', 'C2') && hasCopyOf(r, 'feature', 'C3'),
      },
      {
        text: { en: 'No merge commits: the history is a straight line', es: 'Sin commits de merge: la historia es una línea recta' },
        check: (r) => 'feature' in r.state.branches && [...r.ancestors(r.state.branches.feature)].every((id) => r.commit(id).parents.length < 2),
      },
      { text: { en: 'You are on feature', es: 'Estás en feature' }, check: (r) => onBranch(r, 'feature') },
    ],
  },
  {
    id: 'head',
    title: { en: 'HEAD: where you stand', es: 'HEAD: dónde estás parado' },
    lesson: {
      en: '<p><b>HEAD</b> means "you are here". Normally it is attached to a branch. If you check out a <i>commit</i> instead of a branch, HEAD becomes <b>detached</b>: you are visiting the past.</p><p>Every commit has an id (C0, C1...). In real Git it looks like <code>a1b2c3d</code>.</p>',
      es: '<p><b>HEAD</b> significa "estás aquí". Normalmente está pegado a una rama. Si haces checkout de un <i>commit</i> en vez de una rama, HEAD queda <b>separado</b> (detached): estás visitando el pasado.</p><p>Cada commit tiene un id (C0, C1...). En Git real se ve como <code>a1b2c3d</code>.</p>',
    },
    real: {
      en: 'Detached HEAD is great for looking at old code or finding when a bug appeared. If you want to keep work you do there, create a branch: <code>git switch -c rescue</code>.',
      es: 'HEAD separado sirve para mirar código viejo o encontrar cuándo apareció un bug. Si quieres guardar lo que hagas ahí, crea una rama: <code>git switch -c rescate</code>.',
    },
    commands: ['git checkout C1', 'git switch --detach C1'],
    setup: ['git commit', 'git commit', 'git commit'],
    solution: ['git checkout C1'],
    goals: [
      { text: { en: 'HEAD is detached (not on a branch)', es: 'HEAD está separado (no está en una rama)' }, check: (r) => r.currentBranch() === null },
      { text: { en: 'HEAD points to C1', es: 'HEAD apunta a C1' }, check: (r) => r.headCommit() === 'C1' },
    ],
  },
  {
    id: 'relative',
    title: { en: 'Relative refs: ~ and ^', es: 'Referencias relativas: ~ y ^' },
    lesson: {
      en: '<p>Typing ids is slow. Git lets you move relative to a name: <b>main^</b> is "the parent of main", and <b>main~3</b> is "3 steps back from main". <b>HEAD~1</b> is "one step back from where I am".</p>',
      es: '<p>Escribir ids es lento. Git te deja moverte relativo a un nombre: <b>main^</b> es "el padre de main" y <b>main~3</b> es "3 pasos atrás de main". <b>HEAD~1</b> es "un paso atrás de donde estoy".</p>',
    },
    real: {
      en: '<code>git diff HEAD~1</code> shows what changed in the last commit. <code>git branch -f name ref</code> moves a branch anywhere, which is handy to fix a branch you created in the wrong spot.',
      es: '<code>git diff HEAD~1</code> te muestra qué cambió en el último commit. <code>git branch -f nombre ref</code> mueve una rama a cualquier lado, útil para arreglar una rama creada en el lugar equivocado.',
    },
    commands: ['git branch review main~2', 'git checkout main^'],
    setup: ['git commit', 'git commit', 'git commit', 'git commit'],
    solution: ['git branch review main~2', 'git checkout main^'],
    goals: [
      { text: { en: 'A branch called review points to main~2 (C2)', es: 'Una rama llamada review apunta a main~2 (C2)' }, check: (r) => r.state.branches.review === 'C2' },
      { text: { en: 'HEAD is detached at main^ (C3)', es: 'HEAD está separado en main^ (C3)' }, check: (r) => r.currentBranch() === null && r.headCommit() === 'C3' },
    ],
  },
  {
    id: 'undo',
    title: { en: 'Undo: reset vs revert', es: 'Deshacer: reset vs revert' },
    lesson: {
      en: '<p>Two ways to undo a bad commit:</p><p><b>git reset</b> moves the branch backwards, as if the commit never happened. Use it only on <i>private</i> work.</p><p><b>git revert</b> adds a <i>new</i> commit that cancels the bad one. History stays honest, so it is safe on <i>shared</i> branches.</p>',
      es: '<p>Dos formas de deshacer un mal commit:</p><p><b>git reset</b> mueve la rama hacia atrás, como si el commit nunca hubiera pasado. Úsalo solo en trabajo <i>privado</i>.</p><p><b>git revert</b> agrega un commit <i>nuevo</i> que cancela al malo. La historia queda honesta, así que es seguro en ramas <i>compartidas</i>.</p>',
    },
    real: {
      en: 'Rule of thumb: already pushed? Revert. Only on your computer? Reset is fine. Real reset also has modes: <code>--soft</code> keeps your changes, <code>--hard</code> throws them away.',
      es: 'Regla fácil: ¿ya hiciste push? Revert. ¿Solo está en tu PC? Reset está bien. En Git real reset tiene modos: <code>--soft</code> guarda tus cambios, <code>--hard</code> los bota.',
    },
    commands: ['git switch local', 'git reset HEAD~1', 'git switch shared', 'git revert HEAD'],
    setup: ['git commit', 'git switch -c local', 'git commit -m "Oops (private)"', 'git switch -c shared C1', 'git commit -m "Oops (already pushed)"'],
    solution: ['git switch local', 'git reset HEAD~1', 'git switch shared', 'git revert HEAD'],
    goals: [
      { text: { en: 'local no longer has C2 (reset)', es: 'local ya no tiene C2 (reset)' }, check: (r) => r.state.branches.local === 'C1' },
      { text: { en: 'shared keeps C3 but undoes it with a revert commit', es: 'shared conserva C3 pero lo deshace con un commit de revert' }, check: (r) => tip(r, 'shared')?.revertOf === 'C3' },
    ],
  },
  {
    id: 'cherry-pick',
    title: { en: 'Cherry-pick: choose commits', es: 'Cherry-pick: escoger commits' },
    lesson: {
      en: '<p>Sometimes you want <i>some</i> commits from a branch, not all of them. <b>git cherry-pick</b> copies exactly the commits you name onto where you are.</p><p>The <b>experiments</b> branch has two useful fixes (C2 and C4) and one weird test (C3) you do not want.</p>',
      es: '<p>A veces quieres <i>algunos</i> commits de una rama, no todos. <b>git cherry-pick</b> copia exactamente los commits que nombres a donde estás.</p><p>La rama <b>experiments</b> tiene dos arreglos útiles (C2 y C4) y una prueba rara (C3) que no quieres.</p>',
    },
    real: {
      en: 'Common use: a bug is fixed on a development branch and you need just that fix in the version already released.',
      es: 'Uso típico: un bug se arregla en una rama de desarrollo y necesitas solo ese arreglo en la versión ya publicada.',
    },
    commands: ['git cherry-pick C2 C4'],
    setup: ['git commit', 'git switch -c experiments', 'git commit -m "Important fix"', 'git commit -m "Weird test"', 'git commit -m "Another fix"', 'git switch main'],
    solution: ['git cherry-pick C2 C4'],
    goals: [
      { text: { en: 'main has a copy of C2', es: 'main tiene una copia de C2' }, check: (r) => hasCopyOf(r, 'main', 'C2') },
      { text: { en: 'main has a copy of C4', es: 'main tiene una copia de C4' }, check: (r) => hasCopyOf(r, 'main', 'C4') },
      { text: { en: 'main does NOT have C3', es: 'main NO tiene C3' }, check: (r) => !hasCopyOf(r, 'main', 'C3') && !r.isAncestor('C3', r.state.branches.main) },
    ],
  },
  {
    id: 'tags',
    title: { en: 'Tags: mark versions', es: 'Tags: marcar versiones' },
    lesson: {
      en: '<p>A <b>tag</b> is a sticky note that never moves. Branches move forward with every commit; tags stay put forever.</p><p>That is why tags are used for releases: <b>v1.0</b> will always mean exactly that snapshot.</p>',
      es: '<p>Un <b>tag</b> es una notita que nunca se mueve. Las ramas avanzan con cada commit; los tags se quedan quietos para siempre.</p><p>Por eso los tags se usan para versiones: <b>v1.0</b> siempre significará exactamente esa foto.</p>',
    },
    real: {
      en: 'GitHub turns tags into Releases, where you can attach files (like the PDF of this guide). Push them with <code>git push --tags</code>.',
      es: 'GitHub convierte los tags en Releases, donde puedes adjuntar archivos (como el PDF de esta guía). Se suben con <code>git push --tags</code>.',
    },
    commands: ['git tag v1.0 C1', 'git tag v2.0'],
    setup: ['git commit', 'git commit', 'git commit'],
    solution: ['git tag v1.0 C1', 'git tag v2.0'],
    goals: [
      { text: { en: 'Tag v1.0 is on C1', es: 'El tag v1.0 está en C1' }, check: (r) => r.state.tags['v1.0'] === 'C1' },
      { text: { en: 'Tag v2.0 is on the latest main commit', es: 'El tag v2.0 está en el último commit de main' }, check: (r) => r.state.tags['v2.0'] === r.state.branches.main },
    ],
  },
  {
    id: 'final',
    title: { en: 'Final challenge: a real workflow', es: 'Desafío final: un flujo real' },
    lesson: {
      en: '<p>Put it all together, the way teams work every day:</p><p>1. Create <b>feature/login</b> and make 2 commits there.<br>2. Go back to <b>main</b> and merge it with <code>--no-ff</code>, so the history shows that a feature was merged (even if a fast-forward was possible).<br>3. Tag the result as <b>v1.0</b>.</p>',
      es: '<p>Junta todo, como trabajan los equipos todos los días:</p><p>1. Crea <b>feature/login</b> y haz 2 commits ahí.<br>2. Vuelve a <b>main</b> y haz merge con <code>--no-ff</code>, para que la historia muestre que se unió una función (aunque se pudiera hacer fast-forward).<br>3. Marca el resultado como <b>v1.0</b>.</p>',
    },
    real: {
      en: 'This is exactly how this project was built on GitHub: one branch per feature, a pull request for each one, merged into main, then tagged as a release.',
      es: 'Así mismo se construyó este proyecto en GitHub: una rama por función, un pull request para cada una, merge a main y luego un tag de versión.',
    },
    commands: ['git switch -c feature/login', 'git commit', 'git switch main', 'git merge --no-ff feature/login', 'git tag v1.0'],
    setup: ['git commit'],
    solution: ['git switch -c feature/login', 'git commit -m "Login form"', 'git commit -m "Login validation"', 'git switch main', 'git merge --no-ff feature/login', 'git tag v1.0'],
    goals: [
      {
        text: { en: 'feature/login has at least 2 commits of its own', es: 'feature/login tiene al menos 2 commits propios' },
        check: (r) => {
          const f = r.state.branches['feature/login'];
          if (!f) return false;
          // "own" = not in main's history before the merge (main's first parent if main is a merge)
          const m = tip(r, 'main');
          const before = m && m.parents.length === 2 ? m.parents[0] : r.state.branches.main;
          const mainSet = r.ancestors(before);
          return [...r.ancestors(f)].filter((id) => !mainSet.has(id)).length >= 2;
        },
      },
      {
        text: { en: 'main ends in a merge commit that brings in feature/login', es: 'main termina en un commit de merge que trae feature/login' },
        check: (r) => tip(r, 'main')?.parents.length === 2 && tip(r, 'main')?.parents[1] === r.state.branches['feature/login'],
      },
      { text: { en: 'Tag v1.0 is on the latest main commit', es: 'El tag v1.0 está en el último commit de main' }, check: (r) => r.state.tags['v1.0'] === r.state.branches.main && r.state.tags['v1.0'] !== undefined },
      { text: { en: 'You are on main', es: 'Estás en main' }, check: (r) => onBranch(r, 'main') },
    ],
  },
];

/** @param {Level} level @param {Repo} repo */
export function goalStatus(level, repo) {
  return level.goals.map((g) => g.check(repo));
}

/** @param {Level} level @param {Repo} repo */
export function isComplete(level, repo) {
  return goalStatus(level, repo).every(Boolean);
}
