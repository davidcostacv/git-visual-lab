// @ts-check
// Builds the printable guide (EN + ES) from the SAME levels the app uses,
// with "before" and "after" graphs drawn by the same layout code.
// Usage: npm run pdf  -> docs/git-visual-lab-guide-en.pdf, docs/git-visual-lab-guide-es.pdf
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoFrom } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { computeLayout, toSvgString } from '../src/layout.js';

const root = resolve(import.meta.dirname, '..');
const docs = join(root, 'docs');
mkdirSync(docs, { recursive: true });

/** @typedef {'en' | 'es'} Lang */
const COPY = {
  en: {
    title: 'Git Visual Lab',
    subtitle: 'A visual, hands-on guide to Git',
    intro: 'Git is a time machine for your project. It saves snapshots (commits), lets you work on ideas in parallel (branches) and combine them safely (merge and rebase). This guide follows the 10 levels of the interactive app: each one has a short lesson, the starting graph, the commands that solve it and the result.',
    play: 'Play it online',
    before: 'Before',
    after: 'After',
    solution: 'Commands',
    real: 'In real life',
    cheat: 'Cheat sheet',
    legend: 'How to read the graphs: circles are commits (older on the left). Rounded labels are branches; the filled one is where HEAD is. Dashed labels are tags. Faded commits are not reachable anymore.',
    rows: [
      ['git commit -m "msg"', 'Save a snapshot'],
      ['git switch -c name', 'Create a branch and move to it'],
      ['git switch name', 'Move to a branch'],
      ['git merge name', 'Join another branch into yours'],
      ['git rebase name', 'Replay your commits on top of another branch'],
      ['git checkout C1', 'Visit an old commit (detached HEAD)'],
      ['main~2 / HEAD^', 'Two commits back / the parent'],
      ['git reset HEAD~1', 'Move the branch back (private work only)'],
      ['git revert C3', 'Add a commit that undoes C3 (safe when shared)'],
      ['git cherry-pick C2 C4', 'Copy only those commits here'],
      ['git tag v1.0', 'Mark a version (tags never move)'],
      ['git log / git status', 'See history / where you are'],
    ],
  },
  es: {
    title: 'Git Visual Lab',
    subtitle: 'Guía visual y práctica de Git',
    intro: 'Git es una máquina del tiempo para tu proyecto. Guarda fotos (commits), te deja trabajar ideas en paralelo (ramas) y combinarlas con seguridad (merge y rebase). Esta guía sigue los 10 niveles de la app interactiva: cada uno tiene una lección corta, el grafo inicial, los comandos que lo resuelven y el resultado.',
    play: 'Juégalo en línea',
    before: 'Antes',
    after: 'Después',
    solution: 'Comandos',
    real: 'En la vida real',
    cheat: 'Hoja de referencia',
    legend: 'Cómo leer los grafos: los círculos son commits (los viejos a la izquierda). Las etiquetas redondeadas son ramas; la rellena es donde está HEAD. Las punteadas son tags. Los commits apagados ya no se alcanzan.',
    rows: [
      ['git commit -m "msj"', 'Guardar una foto'],
      ['git switch -c nombre', 'Crear una rama y moverte a ella'],
      ['git switch nombre', 'Moverte a una rama'],
      ['git merge nombre', 'Unir otra rama a la tuya'],
      ['git rebase nombre', 'Repetir tus commits encima de otra rama'],
      ['git checkout C1', 'Visitar un commit viejo (HEAD separado)'],
      ['main~2 / HEAD^', 'Dos commits atrás / el padre'],
      ['git reset HEAD~1', 'Mover la rama atrás (solo trabajo privado)'],
      ['git revert C3', 'Agregar un commit que deshace C3 (seguro si es compartido)'],
      ['git cherry-pick C2 C4', 'Copiar solo esos commits aquí'],
      ['git tag v1.0', 'Marcar una versión (los tags no se mueven)'],
      ['git log / git status', 'Ver historia / dónde estás'],
    ],
  },
};

const SITE = 'https://davidcostacv.github.io/git-visual-lab/';
/** @param {string} s */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** @param {Lang} lang */
function html(lang) {
  const c = COPY[lang];
  const css = readFileSync(join(root, 'styles.css'), 'utf8');
  const levels = LEVELS.map((lv, i) => {
    const before = toSvgString(computeLayout(repoFrom(lv.setup, lang)));
    const after = toSvgString(computeLayout(repoFrom([...lv.setup, ...lv.solution], lang)));
    return `
    <section class="lvl">
      <p class="eyebrow">${lang === 'es' ? 'Nivel' : 'Level'} ${i + 1} / ${LEVELS.length}</p>
      <h2>${esc(lv.title[lang])}</h2>
      <div class="body">${lv.lesson[lang]}</div>
      <div class="pair">
        <figure><figcaption>${c.before}</figcaption>${before}</figure>
        <figure><figcaption>${c.after}</figcaption>${after}</figure>
      </div>
      <p class="cmd-label">${c.solution}</p>
      <pre>${lv.solution.map((s) => `$ ${esc(s)}`).join('\n')}</pre>
      <p class="real"><b>${c.real}:</b> ${lv.real[lang]}</p>
    </section>`;
  }).join('');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${c.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
${css}
@page { size: A4; margin: 16mm 15mm; }
html, body { background: #fff; }
:root { --bg:#fff; --surface:#fff; }
body { font-size: 11.5pt; min-height: 0; }
.edges, .pop, .node, .label { animation: none !important; transition: none !important; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: flex-end; page-break-after: always; border-bottom: 6px solid #c8f25a; padding-bottom: 14mm; }
.cover h1 { font: 400 64pt/0.95 var(--font-display); margin: 0 0 6mm; }
.cover .sub { font: italic 20pt/1.2 var(--font-display); color: var(--ink-2); margin: 0 0 14mm; }
.cover .intro { max-width: 150mm; color: var(--ink-2); }
.cover a { font-family: var(--font-mono); font-size: 10pt; }
.legend-box { margin-top: 8mm; font-size: 10pt; color: var(--muted); max-width: 150mm; }
.lvl { page-break-inside: avoid; break-inside: avoid; padding: 6mm 0 8mm; border-bottom: 1px solid var(--line); }
.lvl h2 { font: 400 26pt/1.05 var(--font-display); margin: 2mm 0 3mm; }
.lvl .body p { margin: 0 0 2mm; color: var(--ink-2); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 4mm 0; }
figure { margin: 0; border: 1px solid var(--line); border-radius: 10px; padding: 3mm; display: flex; flex-direction: column; align-items: center; }
figcaption { align-self: flex-start; font: 600 8pt var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
figure svg { max-width: 100%; height: auto; }
.cmd-label { font: 600 8pt var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 0 0 1mm; }
pre { background: #16171b; color: #e9e7df; font: 9.5pt/1.6 var(--font-mono); padding: 3mm 4mm; border-radius: 8px; margin: 0 0 3mm; white-space: pre-wrap; }
.real { font-size: 10pt; color: var(--ink-2); margin: 0; }
.cheat { page-break-before: always; }
.cheat h2 { font: 400 30pt/1 var(--font-display); margin: 0 0 6mm; }
table { width: 100%; border-collapse: collapse; }
td { padding: 2.4mm 2mm; border-bottom: 1px solid var(--line); vertical-align: top; }
td:first-child { font-family: var(--font-mono); font-size: 9.5pt; width: 45%; }
</style></head><body>
<section class="cover">
  <p class="eyebrow">${lang === 'es' ? 'Guía' : 'Guide'} · EN / ES</p>
  <h1>${c.title}</h1>
  <p class="sub">${c.subtitle}</p>
  <p class="intro">${c.intro}</p>
  <p>${c.play}: <a href="${SITE}">${SITE.replace('https://', '')}</a></p>
  <p class="legend-box">${c.legend}</p>
</section>
${levels}
<section class="cheat"><h2>${c.cheat}</h2><table>${c.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></section>
</body></html>`;
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome/Edge found. Set CHROME_PATH to your browser executable.');
  return found;
}

const browser = findBrowser();
for (const lang of /** @type {Lang[]} */ (['en', 'es'])) {
  const htmlPath = join(docs, `guide-${lang}.html`);
  const pdfPath = join(docs, `git-visual-lab-guide-${lang}.pdf`);
  writeFileSync(htmlPath, html(lang));
  execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=8000',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });
  console.log(`✔ ${pdfPath}`);
}
