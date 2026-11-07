# AGENTS.md — Pac-Man (vanilla JS)

Spanish-language project: comments, README, and UI text are Spanish. Keep new comments and user-facing strings in Spanish.

## Project facts

- **No toolchain.** No `package.json`, bundler, tests, linter, or CI. There are no commands to run — don't invent any.
- **Verify manually:** open `src/index.html` in a browser (plain `file://`, no server needed). Arrow keys move; eating all dots wins (`GANASTE`), 3 ghost hits lose (`PERDISTE`).
- **Not ES modules.** Classic `<script>` tags in `src/index.html` must load in order: `maze.js` → `game.js` → `render.js` → `main.js`. Cross-file API is globals on `window`: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` (maze), `createGame`, `update`, `DIRS` (game), `draw` (render). A new JS file does nothing until you add its `<script>` tag to `index.html`.
- **Size coupling across three files:** the maze is 28×31 cells, `TILE = 20` in `render.js`, and the canvas is hardcoded `560×620` in `index.html`. Change one, update the others.
- **`MAZE` is a pristine template.** Never mutate it — `createGame()` copies it into `game.grid` per game, and `render.js` draws from `game.grid` (not `MAZE`) so eaten dots disappear.

## Maze editing rules (`src/js/maze.js`)

- `MAZE_STR` is 31 strings of exactly 28 chars: `#`→1 wall, `.`→2 dot, ` `→0 open, `-`→3 pen door. A ragged row breaks the grid silently.
- Keep rows mirror-symmetric about the vertical center axis. Row 14 is the wrap-around tunnel (actors exit one edge, reappear on the other).
- Door cells (3) block Pac-Man but not ghosts. Pac-Man starts at (13,23); ghosts start inside the pen.

## Spec-driven development

This repo exists to practice spec-driven development (see `README.md`). New features are expected to get a spec before code:

- Specs live in `specs/NN-slug.md` (two-digit zero-padded number, kebab-case slug) and follow `.agents/skills/spec/template.md`: header (Status / Depends on / Date / one-sentence Objective), scope with explicit out-of-scope, data model, implementation plan, boolean acceptance criteria, decisions.
- New specs are `Draft` until the user marks them `Approved` — never auto-approve.
- `.agents/skills/spec/` is installed skill content pinned by `skills-lock.json`; don't edit it as project code.
