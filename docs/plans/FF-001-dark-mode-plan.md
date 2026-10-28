# FF-001: Dark mode — Implementation plan

| Field | Value |
|-------|-------|
| Feature ID | FF-001 |
| Spec | `docs/specs/FF-001-dark-mode.md` |
| Spec approval | Confirmed by user in session on 2026-10-28 ("Approved as written"); spec Status field still reads "Draft" |
| Plan status | Draft (awaiting review) |
| Branch | `feat/FF-001-dark-mode` |
| Author | Claude (implementation-plan skill) |
| Date | 2026-10-28 |

Decisions confirmed by the user in session (2026-10-28): two-state light/dark toggle, no "System" option (spec Q-1); icon-only sun/moon button (spec Q-3); manual verification now, with automated tests added after a separate test-runner spec (spec Q-6). Spec defaults apply to Q-2 (toggle only in the header), Q-4 (instant switch, no animation), and Q-5 (no cross-tab sync).

## 1. Overview
The active theme becomes an explicit `data-theme="light" | "dark"` attribute on `<html>`. A tiny inline script in `index.html` sets it before first paint from the saved choice (or the OS preference), and CSS switches tokens and `color-scheme` on that attribute instead of the `prefers-color-scheme` media query. A `useTheme` hook owns the React state, persistence, and OS-change listening; a `ThemeToggle` icon button inside a new `<header>` in `App.tsx` calls it. No new dependencies.

## 2. Current architecture (relevant parts)
| Area | Finding | Evidence |
|------|---------|----------|
| Light tokens | 10 color tokens on `:root`. | `src/index.css:1-12` |
| Native color scheme | `color-scheme: light dark` on `:root` (follows OS). | `src/index.css:20` |
| Page colors | `:root` uses `color: var(--text)`, `background: var(--bg)`. | `src/index.css:21-22` |
| Dark tokens | Same 10 tokens redefined only inside `@media (prefers-color-scheme: dark)`. | `src/index.css:33-46` |
| Dark-only non-token rule | `#social .button-icon { filter: invert(1) brightness(2) }`, also inside the OS media query. | `src/index.css:48-50` |
| App shell | `#root` is a centered 1126px flex column with side borders. | `src/index.css:53-63` |
| Entry HTML | No `<head>` script; module entry is loaded at the end of `<body>`. | `index.html:3-12` |
| Mount | `<App />` rendered inside `StrictMode`. | `src/main.tsx:6-10` |
| App markup | Fragment of `<section id="center">`, `.ticks`, `<section id="next-steps">`, `.ticks`, `<section id="spacer">`. No `<header>`/`<main>`. | `src/App.tsx:11-118` |
| Existing state | Only the demo counter (`useState`). | `src/App.tsx:8` |
| Focus style pattern | `.counter:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`. | `src/App.css:14-17` |
| Content area grows | `#center` has `flex-grow: 1`, so a header above it doesn't break vertical layout. | `src/App.css:65` |
| Sprite icons | `public/icons.svg` symbols use hard-coded fills (`#08060d`, `#aa3bff`); no sun/moon symbols. | `public/icons.svg:2-22` |
| Vite logo | Has its own internal `prefers-color-scheme` rule; rendered via `<img>`. | `src/assets/vite.svg:1`, `src/App.tsx:16` |
| Lint | ESLint flat config applies JS + typescript-eslint recommended, react-hooks recommended, react-refresh (vite) to `**/*.{ts,tsx}`; HTML is not linted. | `eslint.config.js:10-17` |
| TS rules | `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`; no `strict`. Lib includes `DOM`. | `tsconfig.app.json:5`, `tsconfig.app.json:14-23` |
| Vite config | Only the React plugin; no CSS options. | `vite.config.ts:5-7` |
| Scripts | `dev`, `build` (`tsc -b && vite build`), `lint`, `preview`; **no test script**. | `package.json:6-11` |
| Runtime deps | `react`, `react-dom` only. | `package.json:12-15` |
| Tests | None (no runner, no test files). | `package.json:6-11` |
| Other docs | Only this feature's spec; no other plans. | `docs/specs/FF-001-dark-mode.md` |

## 3. Design

### Theme model
- `type Theme = 'light' | 'dark'` **(new)**, plus `THEME_STORAGE_KEY = 'featureforge-theme'` **(new)**.
- The applied theme is always present as `document.documentElement.dataset.theme` once the inline script has run. It is the single source the CSS reads.

### Data flow
```
page load ── inline <head> script (index.html)
               stored = localStorage[THEME_STORAGE_KEY] (try/catch)
               theme  = stored is 'light'|'dark' ? stored : (OS dark ? 'dark' : 'light')
               <html data-theme={theme}>          ← before first paint (FR-8)

React mount ── useTheme()
               state.theme    = <html data-theme> if valid, else resolveTheme(readStoredTheme(), systemPrefersDark())
               state.explicit = readStoredTheme() !== null
               effect [theme]: <html data-theme> = theme
               effect [explicit]: if !explicit → listen to matchMedia change → setTheme(system) (FR-6)

toggle click ── next = opposite(theme); setState({ theme: next, explicit: true }); writeStoredTheme(next)
```

### Module shapes (signatures only)
`src/features/theme/theme.ts` **(new)**, framework-agnostic helpers, all storage access wrapped in `try/catch`:
```ts
export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY: string
export function isTheme(value: unknown): value is Theme
export function readStoredTheme(): Theme | null          // null if missing, invalid, or storage throws
export function writeStoredTheme(theme: Theme): void     // swallows storage errors
export function getSystemTheme(): Theme                  // matchMedia, 'light' if unavailable
export function resolveTheme(stored: Theme | null, system: Theme): Theme
```
`src/features/theme/useTheme.ts` **(new)**:
```ts
export function useTheme(): { theme: Theme; toggleTheme: () => void }
```
`src/features/theme/ThemeToggle.tsx` **(new)**:
```ts
type ThemeToggleProps = Omit<ComponentPropsWithoutRef<'button'>, 'onClick' | 'aria-pressed' | 'type'>
export function ThemeToggle(props: ThemeToggleProps): JSX.Element
```
- Renders `<button type="button" aria-label="Dark mode" aria-pressed={theme === 'dark'}>` with an inline decorative SVG (`aria-hidden="true"`, `focusable="false"`): a **sun** when light is active, a **moon** when dark is active (FR-2; state shown by shape, not color alone, E-13). Accepts `className` and passes other native attributes onto the button, per `CLAUDE.md`.
- The hook lives in the component that renders the button (only one consumer), so no context provider is needed.

### Header
`App.tsx` gets a `<header className="app-header">` as the first child of its fragment, containing `<ThemeToggle />` aligned to the inline end. No other header content (Q-2 default). Styles in `App.css` using tokens: bottom border `var(--border)`, padding matching existing sections.

### CSS
- `:root` keeps the light token values and sets `color-scheme: light`.
- `:root[data-theme='dark']` holds the dark token values (moved from `src/index.css:34-46`) and `color-scheme: dark`.
- The `@media (prefers-color-scheme: dark)` block (`src/index.css:33-51`) is removed. The social-icon rule becomes `:root[data-theme='dark'] #social .button-icon`.
- Toggle styles (`ThemeToggle.css`, **new**): icon color `var(--text-h)` (20.15:1 light / 16.25:1 dark), hover background `var(--accent-bg)`, focus ring copied from the `.counter` pattern (`var(--accent)`: 4.39:1 light / 6.77:1 dark against `--bg`, passes 3:1 for non-text), 40×40px target (≥24×24, NFR-4). No transitions, so there's no motion to reduce (E-10). A `@media (forced-colors: active)` rule gives the button a `ButtonText` border (E-13).

### Decisions
| Decision | Options considered | Chosen | Reason |
|----------|--------------------|--------|--------|
| How CSS knows the theme | (a) `data-theme` attribute on `<html>`; (b) class on `<html>`; (c) CSS `light-dark()` with `color-scheme` | (a) | Explicit, easy to inspect and test. (c) avoids duplicating tokens but is transpiled by Lightning CSS (installed with Vite 8, `node_modules/lightningcss` 1.33.0) for older build targets; not worth the risk for 10 tokens. |
| Avoiding a flash on reload (FR-8) | (a) inline classic `<script>` in `<head>`; (b) external blocking script in `public/`; (c) set theme in React only | (a) | Runs before first paint with no extra request. (c) paints the CSS default first and fails AC-6. |
| Keeping the OS media query as a no-JS fallback | keep it in addition to `data-theme` / remove it | remove | Without JS the app renders nothing (`index.html:10-11`), so a fallback only colors an empty page and would duplicate all dark token values. See Spec issue S-1. |
| Where state lives | (a) React context provider; (b) hook used by `ThemeToggle` only; (c) DOM only, no React state | (b) | Only one consumer; `CLAUDE.md` says keep state local. (c) can't drive `aria-pressed` cleanly. Lift to context later if another component needs the theme. |
| Initial React state | re-resolve from storage/OS / read `<html data-theme>` set by the script | read attribute, fall back to resolve | Guarantees React and the painted page agree on first render. |
| Explicit choice when storage is unavailable | treat as not explicit (OS can override) / explicit for the session | explicit for the session (in-memory flag) | Matches A-2 (user choice beats OS) while satisfying FR-9. |
| Icon source | (a) add sun/moon symbols to `public/icons.svg`; (b) inline SVG in the component | (b) | Sprite icons use hard-coded fills (`public/icons.svg:3`), and the icon is the only visible cue on an icon-only button, so it shouldn't depend on a separate sprite request. Inline SVG with `currentColor` follows tokens directly. |
| Folder | `src/components/` / `src/features/theme/` | `src/features/theme/` | Single use; `CLAUDE.md` says extract to `components/` only once reused. |
| Header component | separate `AppHeader` component / inline `<header>` in `App.tsx` | inline | It's a few lines with one child; no reuse. |
| Storage access | direct `localStorage` / wrapped helpers | wrapped helpers in `theme.ts` | One place for `try/catch` and validation (FR-9, FR-10), and pure functions are easy to unit-test later. |

## 4. Files
| File | Action | Purpose | Task(s) |
|------|--------|---------|---------|
| `src/features/theme/theme.ts` | create (new) | `Theme` type, storage key, validation, storage read/write, OS lookup, resolution | T-1 |
| `index.html` | modify | Inline pre-paint script in `<head>` that sets `<html data-theme>` | T-2 |
| `src/index.css` | modify | Tokens and `color-scheme` keyed on `data-theme`; remove the OS media query; re-key social-icon rule | T-2 |
| `CLAUDE.md` | modify | Styling note: dark values now live under `:root[data-theme='dark']`, not the media query (keeps docs accurate) | T-2 |
| `src/features/theme/useTheme.ts` | create (new) | Theme state, apply to `<html>`, persist, follow OS when not explicit | T-3 |
| `src/features/theme/ThemeToggle.tsx` | create (new) | Icon-only toggle button with `aria-pressed` | T-4 |
| `src/features/theme/ThemeToggle.css` | create (new) | Toggle styles (tokens, focus ring, target size, forced colors) | T-4 |
| `src/App.tsx` | modify | Add `<header>` with `<ThemeToggle />` before `#center` (`src/App.tsx:12`) | T-4 |
| `src/App.css` | modify | `.app-header` layout styles | T-4 |

No changes to `package.json`, the lockfile, `vite.config.ts`, `eslint.config.js`, or `tsconfig*.json`.

## 5. Dependencies
| Type | Item | Status | Reason / notes |
|------|------|--------|----------------|
| npm package | none | — | Nothing needed; NFR-6. |
| Browser API | `localStorage` | existing | Wrapped in `try/catch` (FR-9). |
| Browser API | `matchMedia('(prefers-color-scheme: dark)')` and its `change` event | existing | First-visit default and FR-6. |
| Spec | Test runner (Vitest + React Testing Library) | proposed, separate spec (FF-002) | Not a blocker for FF-001; enables T-1.x/T-3.x/T-4.x automated tests later. |

## 6. Tasks

### T-0: Branch setup (setup task, no AC)
- **Goal:** start implementation on the branch named in `CLAUDE.md`.
- **Files:** none in `src/`. Commit `docs/specs/FF-001-dark-mode.md` and this plan as `docs(FF-001): add dark mode spec and plan`.
- **Satisfies:** setup only.
- **Tests:** none.
- **Depends on:** plan approval.
- **Done when:** on `feat/FF-001-dark-mode` (created from the current `feat/dark-mode`, which has no commits beyond `main`), docs committed. The uncommitted `.claude/`, `CLAUDE.md`, and `.gitignore` changes are not part of this commit (see Q-2).

### T-1: Theme helpers
- **Goal:** pure, storage-safe helpers for the theme value.
- **Files:** `src/features/theme/theme.ts` (new).
- **Satisfies:** foundation for AC-1, AC-5, AC-9, AC-10 (no visible change yet).
- **Tests:** future unit tests T-1.1–T-1.3 (section 7). Now: lint + build.
- **Depends on:** T-0.
- **Done when:** helpers match the shapes in section 3; every storage access is guarded; no `any`; `npm run lint` and `npm run build` pass. (~40 lines)

### T-2: Theme-driven CSS and pre-paint script
- **Goal:** the page theme is controlled by `<html data-theme>`, set before first paint.
- **Files:** `index.html`, `src/index.css`, `CLAUDE.md` (Styling line).
- **Satisfies:** AC-1, AC-6, AC-10 (load behavior), AC-9 (load behavior), part of AC-3 (all themed areas, social icons, native `color-scheme`).
- **Tests:** manual M-1, M-5, M-8 (section 7).
- **Depends on:** T-1 (uses the same key and values; the inline script can't import TS, so it carries a comment pointing to `THEME_STORAGE_KEY` in `theme.ts`).
- **Done when:** with no saved value the app looks exactly as today for OS light and OS dark; setting the storage key to `dark`/`light` in DevTools and reloading shows that theme with no flash; an invalid value falls back to the OS; blocked storage causes no console error; lint and build pass. (~45 lines)

### T-3: `useTheme` hook
- **Goal:** React state for the theme, synced to `<html>`, storage, and OS changes.
- **Files:** `src/features/theme/useTheme.ts` (new).
- **Satisfies:** AC-7, AC-8, AC-9 (session toggle), groundwork for AC-3, AC-5.
- **Tests:** future T-3.1–T-3.3; now lint + build (react-hooks rules must pass with no suppressions).
- **Depends on:** T-1.
- **Done when:** initial state reads `<html data-theme>`; the `matchMedia` listener is attached only when `explicit` is false and is removed on cleanup (safe under `StrictMode`, E-11); `toggleTheme` sets `explicit` and writes storage; lint and build pass. (~45 lines)

### T-4: Header and `ThemeToggle`
- **Goal:** the visible, accessible toggle in a header landmark.
- **Files:** `src/features/theme/ThemeToggle.tsx` (new), `src/features/theme/ThemeToggle.css` (new), `src/App.tsx`, `src/App.css`.
- **Satisfies:** AC-2, AC-3, AC-4, AC-5, AC-11, AC-12.
- **Tests:** future T-4.1–T-4.3; manual M-2–M-4, M-6, M-9–M-12.
- **Depends on:** T-2, T-3.
- **Done when:** a `<header>` is the first element in `#root`; the button has accessible name "Dark mode", `aria-pressed` matching the theme, a sun or moon icon by theme, a visible focus ring, a 40×40px target, and works with mouse, Enter and Space; lint and build pass. (~90 lines)

### T-5: Verification
- **Goal:** confirm every AC and quality gate.
- **Steps:** run section 8 commands; walk the AC coverage matrix (section 9) using manual checks M-1–M-12 in `npm run dev` and in `npm run preview` (production build); keyboard pass and screen-reader pass (NVDA + Chrome or Firefox on Windows); both themes; 320px width, 200%/400% zoom; reduced motion and forced-colors emulation. Then run `code-reviewer` and `test-engineer` subagents in parallel per `CLAUDE.md`.
- **Done when:** everything passes, or failures are fixed or explicitly reported; results recorded in the implementation summary.

## 7. Test plan
**Tooling:** none in repo (`package.json:6-11`). Automated tests are blocked on a separate test-runner spec (user decision, 2026-10-28). Until then: `npm run lint`, `npm run build`, and the manual checks below. The automated cases are listed so the follow-up spec can add them without re-planning.

**Future automated tests (after the test-runner spec)**
| # | Level | Scenario | Covers | Task |
|---|-------|----------|--------|------|
| T-1.1 | unit | `isTheme` accepts only `'light'`/`'dark'`; `readStoredTheme` returns `null` for missing, invalid (`'blue'`, `''`) values and when storage throws | AC-9, AC-10 | T-1 |
| T-1.2 | unit | `writeStoredTheme` writes the value; does not throw when storage throws | AC-5, AC-9 | T-1 |
| T-1.3 | unit | `resolveTheme` prefers a stored value over the system value; falls back to system | AC-1, AC-5 | T-1 |
| T-3.1 | unit (hook) | Mocked `matchMedia` `change` updates the theme when nothing is stored | AC-8 | T-3 |
| T-3.2 | unit (hook) | After `toggleTheme`, a `matchMedia` change does not alter the theme | AC-7 | T-3 |
| T-3.3 | unit (hook) | Toggle works and the theme updates with a throwing storage mock | AC-9 | T-3 |
| T-4.1 | component | `getByRole('banner')` contains `getByRole('button', { name: 'Dark mode' })` | AC-2, AC-11 | T-4 |
| T-4.2 | component | Click / Enter / Space flip `aria-pressed` and `<html data-theme>`; focus stays on the button | AC-3, AC-4, AC-11 | T-4 |
| T-4.3 | component | Toggling writes the storage value; re-mounting with that value starts in that theme | AC-5 | T-4 |

**Manual checks (now)**
| # | Level | Scenario | Covers | Task |
|---|-------|----------|--------|------|
| M-1 | manual | Clear storage. DevTools Rendering → emulate `prefers-color-scheme: dark`, reload: dark, toggle shows moon/pressed. Emulate light, reload: light, sun/not pressed. | AC-1 | T-2, T-5 |
| M-2 | manual | At 320px, 768px, 1280px: header is above all content and the toggle is visible. Accessibility tree shows a `banner` landmark. | AC-2 | T-4, T-5 |
| M-3 | manual | Click the toggle: background, text, headings, borders, `code`, counter button, link pills, social icons, Vite logo, focus ring and scrollbar all switch; click again to revert. | AC-3, E-7, E-8 | T-4, T-5 |
| M-4 | manual | Tab to the toggle (first stop), press Enter, then Space: theme switches each time, focus stays on it with a visible ring. | AC-4 | T-4, T-5 |
| M-5 | manual | OS light, choose dark, reload and close/reopen the tab: dark. Repeat with OS dark, choose light. | AC-5 | T-2, T-5 |
| M-6 | manual | With a theme saved opposite to the OS, reload with CPU throttling 6× and a Performance recording; check the first frames for the wrong theme. Repeat via back/forward. | AC-6, E-6 | T-2, T-5 |
| M-7 | manual | Choose light, then emulate OS dark: app stays light. Clear storage and reload, then switch the emulated OS: app follows. | AC-7, AC-8, E-5 | T-3, T-5 |
| M-8 | manual | Block site storage (Chrome: Settings → Site settings → block cookies and site data for localhost), reload, toggle: works, no console errors. Then set the stored value to `"blue"` and `""`, reload: OS theme, then a toggle saves a valid value. | AC-9, AC-10, E-2, E-3 | T-2, T-3, T-5 |
| M-9 | manual | NVDA: toggle announced as "Dark mode, toggle button, not pressed / pressed"; after activation the new state is announced. | AC-11 | T-4, T-5 |
| M-10 | manual | Contrast (DevTools picker or axe) in both themes: toggle icon, focus ring, hover state, header border context, existing text. Target size ≥ 24×24px. | AC-11, AC-12 | T-4, T-5 |
| M-11 | manual | 200% and 400% zoom, `prefers-reduced-motion: reduce` emulation, `forced-colors: active` emulation, holding Enter / rapid clicks (final theme, `aria-pressed`, and stored value agree). | E-4, E-9, E-10, E-13 | T-4, T-5 |
| M-12 | manual | `npm run dev` with `StrictMode`: one toggle = one theme change; no duplicate listeners (DevTools Event Listeners on the media query isn't visible, so check by toggling the emulated OS repeatedly with nothing stored). | E-11 | T-3, T-5 |

## 8. Validation commands
```
npm run lint
npm run build
npm run preview   # manual checks M-1–M-12 against the production build
```
No `npm test` yet (no runner; see section 7).

## 9. AC coverage matrix
| AC | Description (short) | Task(s) | Test(s) / manual check |
|----|---------------------|---------|------------------------|
| AC-1 | First visit follows OS | T-1, T-2 | T-1.3, M-1 |
| AC-2 | Header with toggle present | T-4 | T-4.1, M-2 |
| AC-3 | Toggle switches whole UI | T-2, T-4 | T-4.2, M-3 |
| AC-4 | Keyboard operation, focus stays | T-4 | T-4.2, M-4 |
| AC-5 | Choice persists across reload | T-1, T-3, T-4 | T-1.2, T-1.3, T-4.3, M-5 |
| AC-6 | No flash on reload | T-2 | M-6 |
| AC-7 | Saved choice beats OS change | T-3 | T-3.2, M-7 |
| AC-8 | No saved choice follows OS change | T-3 | T-3.1, M-7 |
| AC-9 | Storage unavailable | T-1, T-2, T-3 | T-1.1, T-1.2, T-3.3, M-8 |
| AC-10 | Invalid saved value | T-1, T-2 | T-1.1, M-8 |
| AC-11 | Accessible toggle (name, role, state, focus, size) | T-4 | T-4.1, T-4.2, M-9, M-10 |
| AC-12 | Contrast in both themes | T-2, T-4 | M-10 |

Every AC has at least one task and one check. AC-6 and AC-12 can only be verified manually, even after a runner exists (paint timing and rendered contrast).

## 10. Risks
| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R-1 | Inline script and `theme.ts` drift apart (key name or valid values), causing a flash or ignored choice. | M | M | Keep the script minimal; a comment in each points to the other; M-5/M-6 verify; a future test can assert the HTML contains `THEME_STORAGE_KEY`. |
| R-2 | The Vite logo's internal OS media query (`src/assets/vite.svg:1`) follows the OS, not `data-theme`, in some browsers, leaving black parentheses on the dark background (spec A-4, E-7). | M | L | Check in M-3 in Chrome, Firefox and Edge. If it fails, stop and ask before changing anything: it would need a plan change (e.g. scoped filter or a different asset). It's scaffold content. |
| R-3 | Light `--accent` fails 4.5:1 for text (4.39:1). | L | M | The toggle uses no accent text; accent is used only for the focus ring (non-text, 3:1 needed). Existing accent text (`.counter`, `src/App.css:5`) is out of scope; flagged as Q-3. |
| R-4 | Removing the OS media query changes behavior for anyone relying on it (e.g. the blank no-JS page). | L | L | S-1 below; inline script resolves the OS theme on every first visit, so JS users see no change. |
| R-5 | `StrictMode` double effects add duplicate `matchMedia` listeners or double-toggle. | L | M | Cleanup in the effect; toggle writes from the event handler, not inside a state updater; M-12. |
| R-6 | Manual-only verification misses regressions later. | M | M | Automated cases are pre-listed (section 7) for the test-runner spec. |
| R-7 | Header changes the page layout (extra height pushes `#center` content). | L | L | `#center` is `flex-grow: 1` (`src/App.css:65`); compare before/after screenshots at 320px and 1280px. |

## 11. Spec issues
- **S-1 (E-12, JavaScript disabled):** The spec expects "the page shows the OS-based theme as today". Without JavaScript the app renders nothing (`index.html:10-11` only mounts React), so the only visible effect is the empty page's background color. Keeping the OS media query just for that would duplicate all dark token values. **Proposed:** drop the no-JS fallback; with JS off the empty page is light. Please confirm or ask for the fallback to be kept.
- **S-2 (spec status):** The spec's Status field still says "Draft (awaiting review)". You approved it in session; the plan records that. Should the Status be updated to "Approved" in the T-0 docs commit? (This plan won't edit it unless you say so.)

## 12. Open questions
- **Q-1:** Accept S-1 (no no-JS fallback)?
- **Q-2:** The Claude Code config (`.claude/`, `CLAUDE.md`, `.gitignore`) is uncommitted. Commit it separately first as `chore: add Claude Code config` on a `chore/` branch, or leave it out of FF-001 entirely? It shouldn't go in the feature commits.
- **Q-3:** Light-mode `--accent` text (4.39:1) on the existing counter button already fails AA. Out of scope for FF-001; want a follow-up spec?

## 13. Next step
Review and approve this plan. Implementation then starts on `feat/FF-001-dark-mode`, one task per commit. No code until the plan is approved.
