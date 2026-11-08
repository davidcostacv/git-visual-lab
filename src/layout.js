// @ts-check
/**
 * Turns a Repo into positions for drawing: commits flow left -> right (older -> newer),
 * each branch gets its own horizontal lane. Pure functions, so the web app and the
 * PDF builder draw exactly the same picture.
 */

/** @typedef {import('./engine.js').Repo} Repo */
/**
 * @typedef {{ id: string, x: number, y: number, lane: number, msg: string, reachable: boolean, isHead: boolean }} NodeBox
 * @typedef {{ key: string, d: string, lane: number, reachable: boolean }} Edge
 * @typedef {{ key: string, text: string, kind: 'branch' | 'tag' | 'head', x: number, y: number, w: number, lane: number, active: boolean }} Label
 * @typedef {{ width: number, height: number, nodes: NodeBox[], edges: Edge[], labels: Label[] }} Layout
 */

export const GEOM = { colW: 92, laneGap: 44, padX: 46, padY: 22, r: 17, pillH: 22, pillGap: 4, charW: 7.3 };

/** @param {string} text */
export function pillWidth(text) {
  return Math.round(text.length * GEOM.charW + 18);
}

/**
 * @param {Repo} repo
 * @returns {Layout}
 */
export function computeLayout(repo) {
  const s = repo.state;
  const ordered = Object.values(s.commits).sort((a, b) => a.seq - b.seq);

  // 1. column = distance from the first commit (parents always come before children in seq order)
  /** @type {Record<string, number>} */
  const col = {};
  for (const c of ordered) col[c.id] = c.parents.length ? Math.max(...c.parents.map((p) => col[p])) + 1 : 0;

  // 2. lanes: walk each branch back along first parents; first come, first served
  /** @type {Record<string, number>} */
  const lane = {};
  let nextLane = 0;
  /** @param {string} tip */
  const claim = (tip) => {
    if (lane[tip] !== undefined) return;
    const L = nextLane++;
    /** @type {string | undefined} */
    let c = tip;
    while (c !== undefined && lane[c] === undefined) {
      lane[c] = L;
      c = s.commits[c].parents[0];
    }
  };
  for (const b of s.branchOrder) claim(s.branches[b]);
  for (const id of Object.values(s.tags)) claim(id);
  claim(repo.headCommit());
  for (const c of [...ordered].reverse()) claim(c.id); // leftovers (e.g. after reset)

  // 3. labels per commit, stacked above it
  const headId = repo.headCommit();
  const current = repo.currentBranch();
  /** @type {Record<string, { key: string, text: string, kind: Label['kind'], active: boolean }[]>} */
  const byCommit = {};
  const push = (/** @type {string} */ id, /** @type {any} */ l) => (byCommit[id] ??= []).push(l);
  for (const b of s.branchOrder) push(s.branches[b], { key: `b:${b}`, text: b, kind: 'branch', active: b === current });
  for (const [name, id] of Object.entries(s.tags)) push(id, { key: `t:${name}`, text: name, kind: 'tag', active: false });
  push(headId, { key: 'HEAD', text: 'HEAD', kind: 'head', active: true });

  // 4. give each label a stack level; bump it up if it would touch a label on a nearby commit
  const xOf = (/** @type {string} */ id) => GEOM.padX + col[id] * GEOM.colW;
  /** @type {{ key: string, text: string, kind: Label['kind'], active: boolean, id: string, x: number, w: number, level: number, lane: number }[]} */
  const placed = [];
  for (const id of Object.keys(byCommit).sort((a, b) => col[a] - col[b])) {
    byCommit[id].forEach((l, i) => {
      const x = xOf(id);
      const w = pillWidth(l.text);
      let level = i;
      while (placed.some((p) => p.lane === lane[id] && p.level === level && Math.abs(p.x - x) < (p.w + w) / 2 + 4)) level++;
      placed.push({ ...l, id, x, w, level, lane: lane[id] });
    });
  }

  // 5. lane heights: each lane reserves room for its tallest label stack
  const laneCount = nextLane;
  const stackOf = (/** @type {number} */ L) => Math.max(0, ...placed.filter((p) => p.lane === L).map((p) => p.level + 1));
  /** @type {number[]} */
  const laneY = [];
  let y = GEOM.padY;
  for (let L = 0; L < laneCount; L++) {
    y += stackOf(L) * (GEOM.pillH + GEOM.pillGap) + GEOM.r + 8;
    laneY.push(y);
    y += GEOM.r + GEOM.laneGap - 16;
  }

  const reach = repo.reachable();
  const pos = (/** @type {string} */ id) => ({ x: GEOM.padX + col[id] * GEOM.colW, y: laneY[lane[id]] });

  /** @type {NodeBox[]} */
  const nodes = ordered.map((c) => ({
    id: c.id,
    ...pos(c.id),
    lane: lane[c.id],
    msg: c.msg,
    reachable: reach.has(c.id),
    isHead: c.id === headId,
  }));

  /** @type {Edge[]} */
  const edges = [];
  for (const c of ordered) {
    for (const p of c.parents) {
      const a = pos(p);
      const b = pos(c.id);
      const d =
        a.y === b.y
          ? `M${a.x} ${a.y}L${b.x} ${b.y}`
          : `M${a.x} ${a.y}C${a.x + GEOM.colW * 0.55} ${a.y} ${b.x - GEOM.colW * 0.55} ${b.y} ${b.x} ${b.y}`;
      edges.push({ key: `${p}>${c.id}`, d, lane: lane[c.id], reachable: reach.has(c.id) });
    }
  }

  /** @type {Label[]} */
  const labels = placed.map(({ key, text, kind, active, id, x, w, level }) => ({
    key,
    text,
    kind,
    active,
    x,
    y: pos(id).y - GEOM.r - 6 - GEOM.pillH / 2 - level * (GEOM.pillH + GEOM.pillGap),
    w,
    lane: lane[id],
  }));

  const maxCol = Math.max(...ordered.map((c) => col[c.id]));
  const widestLabel = Math.max(0, ...labels.map((l) => l.w));
  return {
    width: GEOM.padX * 2 + maxCol * GEOM.colW + Math.max(0, widestLabel / 2 - GEOM.padX + 8),
    height: y + GEOM.padY - GEOM.laneGap + 16,
    nodes,
    edges,
    labels,
  };
}

/** @param {string} s */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** SVG markup for one label pill (shared by the string and DOM renderers). @param {Label} l */
export function labelInner(l) {
  const h = GEOM.pillH;
  return `<rect x="${-l.w / 2}" y="${-h / 2}" width="${l.w}" height="${h}" rx="${h / 2}"/><text y="4" text-anchor="middle">${esc(l.text)}</text>`;
}

/** SVG markup for one commit node. @param {NodeBox} n */
export function nodeInner(n) {
  return `<title>${esc(`${n.id}: ${n.msg}`)}</title><circle r="${GEOM.r}"/><text y="4" text-anchor="middle">${esc(n.id)}</text>`;
}

/** @param {Label} l */
export function labelClass(l) {
  return `label label-${l.kind}${l.active ? ' is-active' : ''} lane-${l.lane % 6}`;
}

/** @param {NodeBox} n */
export function nodeClass(n) {
  return `node lane-${n.lane % 6}${n.reachable ? '' : ' is-faded'}${n.isHead ? ' is-head' : ''}`;
}

/** @param {Edge} e */
export function edgeClass(e) {
  return `edge lane-${e.lane % 6}${e.reachable ? '' : ' is-faded'}`;
}

/**
 * Static SVG (used by the PDF builder).
 * @param {Layout} layout
 */
export function toSvgString(layout) {
  const { width, height } = layout;
  const edges = layout.edges.map((e) => `<path class="${edgeClass(e)}" d="${e.d}"/>`).join('');
  const nodes = layout.nodes
    .map((n) => `<g class="${nodeClass(n)}" transform="translate(${n.x} ${n.y})">${nodeInner(n)}</g>`)
    .join('');
  const labels = layout.labels
    .map((l) => `<g class="${labelClass(l)}" transform="translate(${l.x} ${l.y})">${labelInner(l)}</g>`)
    .join('');
  return `<svg class="graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><g class="edges">${edges}</g><g class="nodes">${nodes}</g><g class="labels">${labels}</g></svg>`;
}
