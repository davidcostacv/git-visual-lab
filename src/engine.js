// @ts-check
/**
 * A tiny Git simulator. It models only what you need to understand Git:
 * commits (snapshots), branches and tags (sticky notes pointing at commits)
 * and HEAD (where you are standing). No files, no diffs.
 *
 * Pure logic: no DOM, so it runs the same in the browser, in tests and in the PDF builder.
 */
import { t } from './i18n.js';

/**
 * @typedef {{ id: string, parents: string[], msg: string, seq: number, copyOf?: string, revertOf?: string }} Commit
 * @typedef {{ type: 'branch', name: string } | { type: 'detached', commit: string }} Head
 * @typedef {{
 *   commits: Record<string, Commit>,
 *   branches: Record<string, string>,
 *   branchOrder: string[],
 *   tags: Record<string, string>,
 *   head: Head,
 *   nextId: number,
 *   seq: number,
 * }} RepoState
 * @typedef {{ ok: boolean, output: string }} RunResult
 * @typedef {import('./i18n.js').Lang} Lang
 */

export class GitError extends Error {
  /** @param {string} code @param {Record<string, string | number>} [params] */
  constructor(code, params = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

/** @param {Lang} [lang] @returns {RepoState} */
export function createState(lang = 'en') {
  return {
    commits: { C0: { id: 'C0', parents: [], msg: t(lang, 'initialCommit'), seq: 0 } },
    branches: { main: 'C0' },
    branchOrder: ['main'],
    tags: {},
    head: { type: 'branch', name: 'main' },
    nextId: 1,
    seq: 1,
  };
}

/**
 * Split a command line into words, keeping "quoted text" together.
 * @param {string} line
 */
export function tokenize(line) {
  /** @type {string[]} */
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const NAME_RE = /^[A-Za-z0-9._/-]+$/;
const COMMIT_ID_RE = /^C\d+'*$/i;

export class Repo {
  /** @param {RepoState} [state] @param {Lang} [lang] */
  constructor(state = undefined, lang = 'en') {
    this.state = state ?? createState(lang);
    this.lang = lang;
  }

  clone() {
    return new Repo(structuredClone(this.state), this.lang);
  }

  // ---------- queries ----------

  /** @param {string} id */
  commit(id) {
    return this.state.commits[id];
  }

  /** Commit id HEAD points to. */
  headCommit() {
    const h = this.state.head;
    return h.type === 'branch' ? this.state.branches[h.name] : h.commit;
  }

  /** Name of the branch you are on, or null when HEAD is detached. */
  currentBranch() {
    const h = this.state.head;
    return h.type === 'branch' ? h.name : null;
  }

  /** All commits reachable from `id` (including itself). @param {string} id */
  ancestors(id) {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const c = /** @type {string} */ (stack.pop());
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(...this.state.commits[c].parents);
    }
    return seen;
  }

  /** Is `a` part of the history of `b`? @param {string} a @param {string} b */
  isAncestor(a, b) {
    return this.ancestors(b).has(a);
  }

  /** Commits reachable from any branch, tag or HEAD. */
  reachable() {
    const s = this.state;
    const tips = [...Object.values(s.branches), ...Object.values(s.tags), this.headCommit()];
    const all = new Set();
    for (const tip of tips) for (const c of this.ancestors(tip)) all.add(c);
    return all;
  }

  /**
   * Turn a reference into a commit id.
   * Supports: HEAD, branch, tag, C3, and suffixes ~n and ^n (e.g. main~2, HEAD^, C5^2).
   * @param {string} ref
   */
  resolve(ref) {
    const m = /^([^~^]+)((?:[~^]\d*)*)$/.exec(ref);
    if (!m) throw new GitError('badRef', { ref });
    let id = this.resolveBase(m[1]);
    for (const [, op, digits] of m[2].matchAll(/([~^])(\d*)/g)) {
      const n = digits === '' ? 1 : Number(digits);
      if (op === '~') {
        for (let i = 0; i < n; i++) id = this.parentOf(id, 0, ref);
      } else if (n > 0) {
        id = this.parentOf(id, n - 1, ref);
      }
    }
    return id;
  }

  /** @param {string} name */
  resolveBase(name) {
    const s = this.state;
    if (name === 'HEAD' || name === '@') return this.headCommit();
    // same order as real git: tags win over branches with the same name
    if (Object.hasOwn(s.tags, name)) return s.tags[name];
    if (Object.hasOwn(s.branches, name)) return s.branches[name];
    const id = Object.keys(s.commits).find((k) => k.toLowerCase() === name.toLowerCase());
    if (id) return id;
    throw new GitError('badRef', { ref: name });
  }

  /** @param {string} id @param {number} index @param {string} ref */
  parentOf(id, index, ref) {
    const p = this.state.commits[id].parents[index];
    if (!p) throw new GitError('noParent', { ref });
    return p;
  }

  /** Text that describes where you are, e.g. "main" or "HEAD". */
  where() {
    return this.currentBranch() ?? 'HEAD';
  }

  // ---------- low-level mutations ----------

  /** @param {Omit<Commit, 'seq'>} fields */
  addCommit(fields) {
    const c = { ...fields, seq: this.state.seq++ };
    this.state.commits[c.id] = c;
    return c;
  }

  newId() {
    return `C${this.state.nextId++}`;
  }

  /** Id for a copy of a commit: C2 -> C2', C2' -> C2''. @param {string} orig */
  copyId(orig) {
    let id = `${orig}'`;
    while (this.state.commits[id]) id += "'";
    return id;
  }

  /** Move whatever HEAD points at (the branch, or HEAD itself). @param {string} id */
  moveHead(id) {
    const h = this.state.head;
    if (h.type === 'branch') this.state.branches[h.name] = id;
    else h.commit = id;
  }

  /** @param {string} name */
  checkName(name) {
    if (!NAME_RE.test(name) || name === 'HEAD' || name.startsWith('-') || COMMIT_ID_RE.test(name)) {
      throw new GitError('badName', { name });
    }
  }

  /** @param {string} name @param {string} id */
  setBranch(name, id) {
    if (!(Object.hasOwn(this.state.branches, name))) this.state.branchOrder.push(name);
    this.state.branches[name] = id;
  }

  /** @param {string} id */
  origin(id) {
    const c = this.state.commits[id];
    return c.copyOf ?? c.id;
  }

  // ---------- the command line ----------

  /**
   * Run one command. Never throws: errors come back as { ok: false }.
   * If a command fails half-way, the repository is left exactly as before.
   * @param {string} line
   * @returns {RunResult}
   */
  run(line) {
    let backup = this.state;
    try {
      backup = structuredClone(this.state);
      return { ok: true, output: this.exec(tokenize(line.trim())) };
    } catch (err) {
      this.state = backup;
      if (err instanceof GitError) return { ok: false, output: t(this.lang, err.code, err.params) };
      throw err;
    }
  }

  /** @param {string[]} words */
  exec(words) {
    if (words.length === 0) return '';
    const [first, sub, ...args] = words;
    if (first !== 'git') throw new GitError('notGit', { cmd: first });
    if (!sub) throw new GitError('missingSub');
    switch (sub) {
      case 'commit': return this.cmdCommit(args);
      case 'branch': return this.cmdBranch(args);
      case 'checkout': return this.cmdCheckout(args);
      case 'switch': return this.cmdSwitch(args);
      case 'merge': return this.cmdMerge(args);
      case 'rebase': return this.cmdRebase(args);
      case 'reset': return this.cmdReset(args);
      case 'revert': return this.cmdRevert(args);
      case 'cherry-pick': return this.cmdCherryPick(args);
      case 'tag': return this.cmdTag(args);
      case 'log': return this.cmdLog(args);
      case 'status': return this.cmdStatus();
      default: throw new GitError('unknownSub', { sub });
    }
  }

  /** @param {string} code @param {Record<string, string | number>} [params] */
  say(code, params) {
    return t(this.lang, code, params);
  }

  /** @param {string[]} args */
  cmdCommit(args) {
    let msg = null;
    let amend = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-m' || a === '-am') {
        msg = args[++i];
        if (msg === undefined) throw new GitError('missingArg', { sub: 'commit -m', what: '"message"' });
      } else if (a === '--amend') amend = true;
      else if (a === '-a') continue;
      else throw new GitError('unknownFlag', { flag: a, sub: 'commit' });
    }
    const current = this.headCommit();
    if (amend) {
      const old = this.commit(current);
      const id = this.copyId(current);
      const c = this.addCommit({ id, parents: [...old.parents], msg: msg ?? old.msg });
      this.moveHead(id);
      return this.say('amended', { where: this.where(), id, msg: c.msg, old: old.id });
    }
    const id = this.newId();
    const c = this.addCommit({ id, parents: [current], msg: msg ?? this.say('commitMsg', { id }) });
    this.moveHead(id);
    return this.say('committed', { where: this.where(), id, msg: c.msg });
  }

  /** @param {string[]} args */
  cmdBranch(args) {
    const s = this.state;
    if (args.length === 0) {
      return s.branchOrder.map((b) => `${b === this.currentBranch() ? '*' : ' '} ${b}`).join('\n');
    }
    const [a, b, c] = args;
    if (a === '-d' || a === '-D' || a === '--delete') {
      if (!b) throw new GitError('missingArg', { sub: 'branch -d', what: 'a branch name' });
      if (!(Object.hasOwn(s.branches, b))) throw new GitError('noBranch', { name: b });
      if (b === this.currentBranch()) throw new GitError('deleteCurrent', { name: b });
      // like real git: -d refuses to lose work, -D forces
      if (a !== '-D' && !this.isAncestor(s.branches[b], this.headCommit())) throw new GitError('notMerged', { name: b });
      const was = s.branches[b];
      delete s.branches[b];
      s.branchOrder = s.branchOrder.filter((n) => n !== b);
      return this.say('branchDeleted', { name: b, id: was });
    }
    if (a === '-f' || a === '--force') {
      if (!b || !c) throw new GitError('missingArg', { sub: 'branch -f', what: 'a branch and a target' });
      if (b === this.currentBranch()) throw new GitError('forceCurrent', { name: b });
      this.checkName(b);
      const id = this.resolve(c);
      this.setBranch(b, id);
      return this.say('branchMoved', { name: b, id });
    }
    if (a.startsWith('-')) throw new GitError('unknownFlag', { flag: a, sub: 'branch' });
    return this.createBranch(a, b);
  }

  /** @param {string} name @param {string} [start] */
  createBranch(name, start) {
    this.checkName(name);
    if (Object.hasOwn(this.state.branches, name)) throw new GitError('branchExists', { name });
    const id = this.resolve(start ?? 'HEAD');
    this.setBranch(name, id);
    return this.say('branchCreated', { name, id });
  }

  /** @param {string} name */
  attach(name) {
    this.state.head = { type: 'branch', name };
    return this.say('switched', { name });
  }

  /** @param {string} ref */
  detach(ref) {
    const id = this.resolve(ref);
    this.state.head = { type: 'detached', commit: id };
    return this.say('detached', { id });
  }

  /** @param {string[]} args */
  cmdCheckout(args) {
    const [a, b, c] = args;
    if (!a) throw new GitError('missingArg', { sub: 'checkout', what: 'a branch or commit' });
    if (a === '-b' || a === '-B') {
      if (!b) throw new GitError('missingArg', { sub: 'checkout -b', what: 'a branch name' });
      if (a === '-B' && Object.hasOwn(this.state.branches, b)) {
        this.checkName(b);
        this.setBranch(b, this.resolve(c ?? 'HEAD')); // -B resets an existing branch
      } else this.createBranch(b, c);
      this.attach(b);
      return this.say('switchedNew', { name: b });
    }
    if (a === '--detach') return this.detach(b ?? 'HEAD');
    if (a.startsWith('-')) throw new GitError('unknownFlag', { flag: a, sub: 'checkout' });
    if (Object.hasOwn(this.state.branches, a)) return this.attach(a);
    return this.detach(a);
  }

  /** @param {string[]} args */
  cmdSwitch(args) {
    const [a, b, c] = args;
    if (!a) throw new GitError('missingArg', { sub: 'switch', what: 'a branch name' });
    if (a === '-c' || a === '-C' || a === '--create') {
      if (!b) throw new GitError('missingArg', { sub: 'switch -c', what: 'a branch name' });
      this.createBranch(b, c);
      this.attach(b);
      return this.say('switchedNew', { name: b });
    }
    if (a === '--detach' || a === '-d') return this.detach(b ?? 'HEAD');
    if (a.startsWith('-')) throw new GitError('unknownFlag', { flag: a, sub: 'switch' });
    if (!(Object.hasOwn(this.state.branches, a))) {
      this.resolve(a); // a typo gets the "can't find" error; a real commit gets the hint below
      throw new GitError('switchNeedsBranch', { ref: a });
    }
    return this.attach(a);
  }

  /** @param {string[]} args */
  cmdMerge(args) {
    const noFf = args.includes('--no-ff');
    const refs = args.filter((a) => a !== '--no-ff');
    const bad = refs.find((a) => a.startsWith('-'));
    if (bad) throw new GitError('unknownFlag', { flag: bad, sub: 'merge' });
    const ref = refs[0];
    if (!ref) throw new GitError('missingArg', { sub: 'merge', what: 'a branch to merge' });
    const target = this.resolve(ref);
    const head = this.headCommit();
    if (this.isAncestor(target, head)) return this.say('upToDate');
    if (!noFf && this.isAncestor(head, target)) {
      this.moveHead(target);
      return this.say('fastForward', { where: this.where(), id: target });
    }
    const id = this.newId();
    const where = this.where();
    this.addCommit({ id, parents: [head, target], msg: this.say('mergeMsg', { ref, where }) });
    this.moveHead(id);
    return this.say('merged', { id, ref, where });
  }

  /** @param {string[]} args */
  cmdRebase(args) {
    const [ontoRef, branch] = args;
    if (!ontoRef) throw new GitError('missingArg', { sub: 'rebase', what: 'a branch to rebase onto' });
    if (ontoRef.startsWith('-')) throw new GitError('unknownFlag', { flag: ontoRef, sub: 'rebase' });
    if (branch) {
      if (!(Object.hasOwn(this.state.branches, branch))) throw new GitError('noBranch', { name: branch });
      this.attach(branch);
    }
    const onto = this.resolve(ontoRef);
    const head = this.headCommit();
    if (this.isAncestor(onto, head)) return this.say('upToDate');
    if (this.isAncestor(head, onto)) {
      this.moveHead(onto);
      return this.say('rebaseFf', { where: this.where(), id: onto });
    }
    const base = this.ancestors(onto);
    // like real git: skip merges and commits whose change is already in the base (e.g. cherry-picked)
    const upstream = new Set([...base].map((id) => this.origin(id)));
    const toCopy = [...this.ancestors(head)]
      .filter((id) => !base.has(id) && this.commit(id).parents.length < 2 && !upstream.has(this.origin(id)))
      .sort((x, y) => this.commit(x).seq - this.commit(y).seq);
    if (toCopy.length === 0) {
      this.moveHead(onto);
      return this.say('rebaseFf', { where: this.where(), id: onto });
    }
    let tip = onto;
    const made = [];
    for (const orig of toCopy) {
      const id = this.copyId(orig);
      this.addCommit({ id, parents: [tip], msg: this.commit(orig).msg, copyOf: this.origin(orig) });
      made.push(id);
      tip = id;
    }
    this.moveHead(tip);
    return this.say('rebased', { list: made.join(', '), onto: ontoRef });
  }

  /** @param {string[]} args */
  cmdReset(args) {
    const modes = ['--hard', '--soft', '--mixed'];
    const refs = args.filter((a) => !modes.includes(a));
    const bad = refs.find((a) => a.startsWith('-'));
    if (bad) throw new GitError('unknownFlag', { flag: bad, sub: 'reset' });
    const id = this.resolve(refs[0] ?? 'HEAD');
    this.moveHead(id);
    return this.say('reset', { where: this.where(), id });
  }

  /** @param {string[]} args */
  cmdRevert(args) {
    const ref = args.filter((a) => a !== '--no-edit')[0];
    if (!ref) throw new GitError('missingArg', { sub: 'revert', what: 'a commit to undo' });
    if (ref.startsWith('-')) throw new GitError('unknownFlag', { flag: ref, sub: 'revert' });
    const target = this.resolve(ref);
    if (!this.isAncestor(target, this.headCommit())) throw new GitError('notInHistory', { id: target });
    if (this.commit(target).parents.length > 1) throw new GitError('mergeCommitRevert', { id: target });
    const id = this.newId();
    this.addCommit({
      id,
      parents: [this.headCommit()],
      msg: this.say('revertMsg', { msg: this.commit(target).msg }),
      revertOf: target,
    });
    this.moveHead(id);
    return this.say('reverted', { id, target });
  }

  /** @param {string[]} args */
  cmdCherryPick(args) {
    const refs = args.filter((a) => a !== '-x');
    if (refs.length === 0) throw new GitError('missingArg', { sub: 'cherry-pick', what: 'one or more commits' });
    const made = [];
    for (const ref of refs) {
      if (ref.startsWith('-')) throw new GitError('unknownFlag', { flag: ref, sub: 'cherry-pick' });
      const src = this.resolve(ref);
      if (this.isAncestor(src, this.headCommit())) throw new GitError('alreadyHere', { id: src });
      if (this.commit(src).parents.length > 1) throw new GitError('mergeCommitPick', { id: src });
      const id = this.copyId(src);
      this.addCommit({ id, parents: [this.headCommit()], msg: this.commit(src).msg, copyOf: this.origin(src) });
      this.moveHead(id);
      made.push(id);
    }
    return this.say('picked', { list: made.join(', '), where: this.where() });
  }

  /** @param {string[]} args */
  cmdTag(args) {
    const s = this.state;
    const [a, b] = args;
    if (!a) {
      const names = Object.keys(s.tags);
      return names.length ? names.map((n) => `${n} -> ${s.tags[n]}`).join('\n') : this.say('noTags');
    }
    if (a === '-d') {
      if (!b) throw new GitError('missingArg', { sub: 'tag -d', what: 'a tag name' });
      if (!(Object.hasOwn(s.tags, b))) throw new GitError('noTag', { name: b });
      delete s.tags[b];
      return this.say('tagDeleted', { name: b });
    }
    if (a.startsWith('-')) throw new GitError('unknownFlag', { flag: a, sub: 'tag' });
    this.checkName(a);
    if (Object.hasOwn(s.tags, a)) throw new GitError('tagExists', { name: a });
    const id = this.resolve(b ?? 'HEAD');
    s.tags[a] = id;
    return this.say('tagCreated', { name: a, id });
  }

  /** Like `git log --oneline`: every commit reachable from the ref, newest first. @param {string[]} args */
  cmdLog(args) {
    const flags = ['--oneline', '--graph', '--all', '--decorate'];
    const refs = args.filter((a) => !flags.includes(a));
    const bad = refs.find((a) => a.startsWith('-'));
    if (bad) throw new GitError('unknownFlag', { flag: bad, sub: 'log' });
    const s = this.state;
    const tips = args.includes('--all')
      ? [...Object.values(s.branches), ...Object.values(s.tags), this.headCommit()]
      : [this.resolve(refs[0] ?? 'HEAD')];
    const ids = new Set();
    for (const tip of tips) for (const id of this.ancestors(tip)) ids.add(id);
    return [...ids]
      .map((id) => this.commit(id))
      .sort((a, b) => b.seq - a.seq)
      .map((c) => {
        const deco = this.decorations(c.id);
        const merge = c.parents.length > 1 ? ` [merge ${c.parents.join(' + ')}]` : '';
        return `${c.id}${deco ? ` (${deco})` : ''} ${c.msg}${merge}`;
      })
      .join('\n');
  }

  /** Labels like "HEAD -> main, tag: v1.0" for git log. @param {string} id */
  decorations(id) {
    const s = this.state;
    const out = [];
    const cur = this.currentBranch();
    if (s.head.type === 'detached' && s.head.commit === id) out.push('HEAD');
    for (const b of s.branchOrder) {
      if (s.branches[b] === id) out.push(b === cur ? `HEAD -> ${b}` : b);
    }
    for (const [name, at] of Object.entries(s.tags)) if (at === id) out.push(`tag: ${name}`);
    return out.join(', ');
  }

  cmdStatus() {
    const cur = this.currentBranch();
    return cur
      ? this.say('onBranch', { name: cur, id: this.headCommit() })
      : this.say('onDetached', { id: this.headCommit() });
  }
}

/**
 * Build a repo by running a list of commands. Throws if any of them fails,
 * because level setups and solutions must always be valid.
 * @param {string[]} commands
 * @param {Lang} [lang]
 */
export function repoFrom(commands, lang = 'en') {
  const repo = new Repo(undefined, lang);
  for (const cmd of commands) {
    const r = repo.run(cmd);
    if (!r.ok) throw new Error(`Setup command failed: "${cmd}" -> ${r.output}`);
  }
  return repo;
}
