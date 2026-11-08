---
name: verify
description: How to run and drive Git Visual Lab to verify a change (local or live site)
---

# Verify Git Visual Lab

## Launch
- Local: `npm start` -> http://localhost:5173 (ES modules: needs a server, not file://).
- Live: https://davidcostacv.github.io/git-visual-lab/ (GitHub Pages from `main`, deploys ~1 min after push).
- Fresh state: `localStorage.removeItem('gvl:progress')` then reload (progress, lang, theme live there).

## Drive
- Routes: `#/level/1` … `#/level/10`, `#/sandbox`.
- Type in the terminal input (`#term-input`) and press Enter, or click a command chip then Enter.
- Each level's official solution is behind "Show solution" (chips) — clicking them in order must complete the level.
- Worth driving: a typo (friendly error, not counted), Undo/Restart buttons, ArrowUp history,
  EN/ES toggle mid-level, Light/Dark, last level's success banner, sandbox after finishing a level.

## Gotchas
- Claude's built-in browser pane, when hidden, does NOT repaint or run animations: screenshots are stale.
  Read the DOM, or use Claude in Chrome (user's browser) for real pixels.
- The user's Chrome forces dark mode on pages: Light theme looks dark there; check computed
  `getComputedStyle(document.body).backgroundColor` instead of trusting the pixels.
- Any element with class `.btn` sets `display`, so check that `hidden` really hides it (computed display).
- PDF URLs open a download dialog in the built-in pane; check them with an HTTP HEAD instead.
