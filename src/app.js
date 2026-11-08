// @ts-check
/**
 * The web app: wires the engine, the levels and the graph to the page.
 * State lives here; everything else is pure and tested.
 */
import { Repo, repoFrom } from './engine.js';
import { LEVELS, goalStatus } from './levels.js';
import { computeLayout, nodeInner, labelInner, nodeClass, labelClass, edgeClass } from './layout.js';
import { t } from './i18n.js';

/** @typedef {import('./i18n.js').Lang} Lang */

const STORE_KEY = 'gvl:progress';
const SVG_NS = 'http://www.w3.org/2000/svg';
const SANDBOX_SETUP = ['git commit', 'git commit'];

/** @template {Element} [T=HTMLElement] @param {string} id @returns {T} */
const $ = (id) => /** @type {T} */ (/** @type {unknown} */ (document.getElementById(id)));

// ---------- saved preferences (per browser; the app works without them) ----------
/** @returns {{ done: string[], lang: Lang, theme: 'auto' | 'light' | 'dark' }} */
function loadPrefs() {
  const defaults = { done: [], lang: /** @type {Lang} */ ('en'), theme: /** @type {'auto'} */ ('auto') };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return defaults;
  }
}
function savePrefs() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: progress just won't be remembered */
  }
}

const prefs = loadPrefs();

// ---------- app state ----------
/** index into LEVELS, or -1 for the free sandbox */
let levelIndex = 0;
let repo = new Repo();
/** @type {Repo[]} */
let undoStack = [];
/** @type {string[]} */
const cmdHistory = [];
let historyPos = 0;
let commandsUsed = 0;
let wasComplete = false;

const els = {
  list: $('level-list'),
  sandbox: $('sandbox-link'),
  eyebrow: $('level-eyebrow'),
  title: $('level-title'),
  lesson: $('lesson-body'),
  goalsCard: $('goals-card'),
  goals: $('goal-list'),
  chips: $('command-chips'),
  real: /** @type {HTMLDetailsElement} */ ($('real-life')),
  realBody: $('real-body'),
  solutionBtn: $('btn-solution'),
  solution: $('solution-chips'),
  svg: /** @type {SVGSVGElement} */ ($('graph')),
  scroll: $('graph-scroll'),
  success: $('success'),
  successText: $('success-text'),
  next: $('btn-next'),
  out: $('term-out'),
  form: $('term-form'),
  input: /** @type {HTMLInputElement} */ ($('term-input')),
  prompt: $('prompt'),
  pdf: /** @type {HTMLAnchorElement} */ ($('pdf-link')),
};

const level = () => (levelIndex >= 0 ? LEVELS[levelIndex] : null);
/** @param {string} code @param {Record<string, string | number>} [p] */
const tr = (code, p) => t(prefs.lang, code, p);

// ---------- graph rendering (keyed, so commits and labels glide instead of jumping) ----------
/** @param {Element} parent @param {string} key */
function keyed(parent, key) {
  return /** @type {SVGGElement | null} */ (parent.querySelector(`[data-key="${CSS.escape(key)}"]`));
}

function renderGraph() {
  const layout = computeLayout(repo);
  const { svg } = els;
  // small histories are drawn bigger, long ones scroll sideways
  const sc = els.scroll;
  const fit = Math.min((sc.clientWidth - 24) / layout.width, (sc.clientHeight - 32) / layout.height);
  const zoom = Math.max(1, Math.min(1.7, fit || 1));
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('width', String(Math.round(layout.width * zoom)));
  svg.setAttribute('height', String(Math.round(layout.height * zoom)));
  const [edgesG, nodesG, labelsG] = /** @type {SVGGElement[]} */ (Array.from(svg.children));

  // edges: redrawn, then faded in once the nodes have mostly arrived
  const before = edgesG.getAttribute('data-keys');
  const after = layout.edges.map((e) => e.key + e.d).join('|');
  if (before !== after) {
    edgesG.innerHTML = layout.edges.map((e) => `<path class="${edgeClass(e)}" d="${e.d}"/>`).join('');
    edgesG.setAttribute('data-keys', after);
    edgesG.classList.remove('fade');
    void edgesG.getBoundingClientRect();
    edgesG.classList.add('fade');
  }

  /**
   * @param {SVGGElement} group
   * @param {{ key: string, x: number, y: number, cls: string, inner: string }[]} items
   */
  const sync = (group, items) => {
    const keep = new Set(items.map((i) => i.key));
    for (const el of Array.from(group.children)) {
      if (!keep.has(el.getAttribute('data-key') || '')) el.remove();
    }
    for (const item of items) {
      // outer <g>: position (CSS transition = glide). inner <g class="pop">: entrance (CSS animation).
      let el = keyed(group, item.key);
      if (!el) {
        el = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
        el.setAttribute('data-key', item.key);
        el.appendChild(document.createElementNS(SVG_NS, 'g')).setAttribute('class', 'pop');
        group.appendChild(el);
      }
      el.style.transform = `translate(${item.x}px, ${item.y}px)`;
      el.setAttribute('class', item.cls);
      const inner = /** @type {SVGGElement} */ (el.firstElementChild);
      if (inner.getAttribute('data-inner') !== item.inner) {
        inner.innerHTML = item.inner;
        inner.setAttribute('data-inner', item.inner);
      }
    }
  };

  sync(nodesG, layout.nodes.map((n) => ({ key: n.id, x: n.x, y: n.y, cls: nodeClass(n), inner: nodeInner(n) })));
  sync(labelsG, layout.labels.map((l) => ({ key: l.key, x: l.x, y: l.y, cls: labelClass(l), inner: labelInner(l) })));

  // keep HEAD in view on long histories
  const head = layout.nodes.find((n) => n.isHead);
  if (head && layout.width * zoom > sc.clientWidth) {
    sc.scrollTo({ left: Math.max(0, head.x * zoom - sc.clientWidth / 2), behavior: 'smooth' });
  }
}

// ---------- lesson panel ----------
function renderLevelList() {
  els.list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#/level/${i + 1}`;
    if (i === levelIndex) a.setAttribute('aria-current', 'page');
    const done = prefs.done.includes(lv.id);
    a.innerHTML = `<span class="lvl-num">${String(i + 1).padStart(2, '0')}</span><span class="lvl-name"></span><span class="lvl-check${done ? ' is-done' : ''}" aria-label="${done ? 'done' : ''}"></span>`;
    /** @type {HTMLElement} */ (a.querySelector('.lvl-name')).textContent = lv.title[prefs.lang];
    li.appendChild(a);
    els.list.appendChild(li);
  });
  if (levelIndex === -1) els.sandbox.setAttribute('aria-current', 'page');
  else els.sandbox.removeAttribute('aria-current');
}

/** @param {HTMLElement} box @param {string[]} commands */
function renderChips(box, commands) {
  box.innerHTML = '';
  for (const c of commands) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = c;
    b.addEventListener('click', () => {
      els.input.value = c;
      els.input.focus();
    });
    box.appendChild(b);
  }
}

function renderLesson() {
  const lv = level();
  if (lv) {
    els.eyebrow.textContent = `${tr('level')} ${levelIndex + 1} / ${LEVELS.length}`;
    els.title.textContent = lv.title[prefs.lang];
    els.lesson.innerHTML = lv.lesson[prefs.lang]; // trusted, static course content
    els.realBody.innerHTML = lv.real[prefs.lang];
    els.real.hidden = false;
    els.goalsCard.hidden = false;
    els.solutionBtn.hidden = false;
    renderChips(els.chips, lv.commands);
    renderChips(els.solution, lv.solution);
  } else {
    els.eyebrow.textContent = '∞';
    els.title.textContent = tr('sandbox');
    renderChips(els.solution, []); // no stale answer from the previous level
    els.lesson.innerHTML = `<p>${tr('sandboxIntro')}</p>`;
    els.real.hidden = true;
    els.goalsCard.hidden = true;
    els.solutionBtn.hidden = true;
    els.solution.hidden = true;
    renderChips(els.chips, ['git commit', 'git switch -c idea', 'git merge idea', 'git rebase main', 'git log']);
  }
  els.solutionBtn.textContent = tr(els.solution.hidden ? 'showSolution' : 'hideSolution');
  renderGoals();
}

function renderGoals() {
  const lv = level();
  if (!lv) {
    els.success.hidden = true;
    els.success.parentElement?.classList.remove('has-success');
    wasComplete = false;
    return;
  }
  const status = goalStatus(lv, repo);
  const existing = Array.from(els.goals.children);
  if (existing.length !== lv.goals.length) {
    els.goals.innerHTML = '';
    for (let i = 0; i < lv.goals.length; i++) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="goal-box" aria-hidden="true"></span><span class="goal-text"></span>';
      els.goals.appendChild(li);
    }
  }
  lv.goals.forEach((g, i) => {
    const li = /** @type {HTMLElement} */ (els.goals.children[i]);
    /** @type {HTMLElement} */ (li.querySelector('.goal-text')).textContent = g.text[prefs.lang];
    li.classList.toggle('is-done', status[i]);
  });

  const complete = status.every(Boolean);
  if (complete && !wasComplete) {
    if (!prefs.done.includes(lv.id)) prefs.done.push(lv.id);
    savePrefs();
    renderLevelList();
  }
  wasComplete = complete;
  els.success.hidden = !complete;
  els.success.parentElement?.classList.toggle('has-success', complete);
  const last = levelIndex === LEVELS.length - 1;
  els.successText.textContent = last ? tr('allDone') : tr('doneText', { n: commandsUsed });
  els.next.hidden = last;
}

function renderPrompt() {
  const where = repo.currentBranch() ?? `(${repo.headCommit()})`;
  els.prompt.textContent = `${where} $`;
}

// ---------- terminal ----------
/** @param {string} text @param {'cmd' | 'out' | 'err' | 'info'} kind @param {string} [i18nKey] */
function print(text, kind, i18nKey) {
  if (!text) return;
  const div = document.createElement('div');
  div.className = `line ${kind}`;
  if (i18nKey) div.setAttribute('data-i18n', i18nKey); // re-translated if the language changes
  div.textContent = text;
  els.out.appendChild(div);
  els.out.scrollTop = els.out.scrollHeight;
}

/** @param {string} raw */
function runCommand(raw) {
  const line = raw.trim();
  if (!line) return;
  cmdHistory.push(line);
  historyPos = cmdHistory.length;
  print(line, 'cmd');
  const word = line.toLowerCase();
  if (word === 'clear' || word === 'limpiar') {
    els.out.innerHTML = '';
    return;
  }
  if (word === 'help' || word === 'ayuda' || word === 'git help') return print(tr('helpText'), 'info', 'helpText');
  if (word === 'undo' || word === 'deshacer') return undo();
  if (word === 'restart' || word === 'reset level' || word === 'reiniciar') return loadLevel(levelIndex);

  const snapshot = repo.clone();
  const res = repo.run(line);
  print(res.output, res.ok ? 'out' : 'err');
  if (res.ok) {
    undoStack.push(snapshot);
    commandsUsed++;
    refresh();
  }
}

function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  repo = prev;
  repo.lang = prefs.lang;
  commandsUsed = Math.max(0, commandsUsed - 1);
  refresh();
}

function refresh() {
  renderGraph();
  renderGoals();
  renderPrompt();
}

// ---------- navigation ----------
/** @param {number} index */
function loadLevel(index) {
  levelIndex = index;
  const lv = level();
  repo = repoFrom(lv ? lv.setup : SANDBOX_SETUP, prefs.lang);
  undoStack = [];
  commandsUsed = 0;
  wasComplete = false;
  els.solution.hidden = true;
  els.out.innerHTML = '';
  print(tr('typeHelp'), 'info', 'typeHelp');
  // re-create the graph from scratch so a new level does not "morph" from the old one
  for (const g of Array.from(els.svg.children)) {
    g.innerHTML = '';
    g.removeAttribute('data-keys');
  }
  renderLevelList();
  renderLesson();
  refresh();
}

function route() {
  const m = /^#\/level\/(\d+)$/.exec(location.hash);
  if (location.hash === '#/sandbox') return loadLevel(-1);
  const n = m ? Number(m[1]) - 1 : 0;
  loadLevel(n >= 0 && n < LEVELS.length ? n : 0);
}

// ---------- language & theme ----------
function applyLang() {
  document.documentElement.lang = prefs.lang;
  repo.lang = prefs.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = tr(/** @type {string} */ (el.getAttribute('data-i18n')));
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    /** @type {HTMLInputElement} */ (el).placeholder = tr(/** @type {string} */ (el.getAttribute('data-i18n-placeholder')));
  }
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === prefs.lang));
  }
  els.pdf.href = `docs/git-visual-lab-guide-${prefs.lang}.pdf`;
  renderLevelList();
  renderLesson();
}

function applyTheme() {
  const root = document.documentElement;
  if (prefs.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', prefs.theme);
  for (const b of document.querySelectorAll('[data-theme-choice]')) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-choice') === prefs.theme));
  }
}

// ---------- events ----------
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  runCommand(els.input.value);
  els.input.value = '';
});
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && historyPos > 0) {
    historyPos--;
    els.input.value = cmdHistory[historyPos];
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    historyPos = Math.min(cmdHistory.length, historyPos + 1);
    els.input.value = cmdHistory[historyPos] ?? '';
    e.preventDefault();
  }
});
$('btn-undo').addEventListener('click', undo);
$('btn-restart').addEventListener('click', () => loadLevel(levelIndex));
els.solutionBtn.addEventListener('click', () => {
  els.solution.hidden = !els.solution.hidden;
  els.solutionBtn.textContent = tr(els.solution.hidden ? 'showSolution' : 'hideSolution');
});
els.next.addEventListener('click', () => {
  location.hash = `#/level/${levelIndex + 2}`;
});
for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => {
    prefs.lang = /** @type {Lang} */ (b.getAttribute('data-lang'));
    savePrefs();
    applyLang();
  });
}
for (const b of document.querySelectorAll('[data-theme-choice]')) {
  b.addEventListener('click', () => {
    prefs.theme = /** @type {'auto' | 'light' | 'dark'} */ (b.getAttribute('data-theme-choice'));
    savePrefs();
    applyTheme();
  });
}
window.addEventListener('hashchange', route);

applyTheme();
route();
applyLang();
els.input.focus({ preventScroll: true });
