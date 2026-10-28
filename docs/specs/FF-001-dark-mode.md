# FF-001: Dark mode

| Field | Value |
|-------|-------|
| Feature ID | FF-001 |
| Status | Draft (awaiting review) |
| Author | Claude (feature-spec skill) |
| Date | 2026-10-28 |
| Request | "Add a dark mode option to FeatureForge. Users should be able to switch between light and dark themes using a toggle in the application header. Their selected theme should persist after refreshing the browser." |
| Related specs | none |

## 1. Summary
FeatureForge already has dark colors, but they only apply when the operating system is set to dark; users can't choose a theme inside the app. This feature adds a light/dark toggle in a new application header and remembers the user's choice across page reloads, so people can use the theme that suits them regardless of their OS setting.

## 2. Current state

| Area | Finding | Evidence |
|------|---------|----------|
| Theme tokens (light) | Color tokens `--text`, `--text-h`, `--bg`, `--border`, `--code-bg`, `--accent`, `--accent-bg`, `--accent-border`, `--social-bg`, `--shadow` are defined on `:root`. | `src/index.css:1-12` |
| Theme tokens (dark) | Dark values for the same tokens exist, but **only** inside `@media (prefers-color-scheme: dark)`. There is no way to select them other than the OS setting. | `src/index.css:33-46` |
| Dark-only style outside tokens | Social link icons are inverted in dark mode by a rule that is also inside the OS media query, not tied to tokens. | `src/index.css:48-50` |
| Native color scheme | `color-scheme: light dark` is set on `:root`, so scrollbars and form controls follow the OS, not an in-app choice. | `src/index.css:20` |
| Page background | `:root` paints `color: var(--text)` and `background: var(--bg)`. | `src/index.css:21-22` |
| Embedded asset with its own theme logic | `vite.svg` contains an internal `@media (prefers-color-scheme: dark)` rule that switches its parenthesis fill between black and white. It is rendered with `<img>`. | `src/assets/vite.svg:1`, `src/App.tsx:16`, `src/App.tsx:45` |
| Application header | **Not present.** `App` renders a fragment containing `<section id="center">`, `.ticks` dividers, `<section id="next-steps">` and `<section id="spacer">`; there is no `<header>`, `<main>` or `<nav>` landmark. | `src/App.tsx:11-118` |
| Theme toggle / theme state | **Not present.** The only React state is the demo counter. | `src/App.tsx:8` |
| Persistence | **Not present.** No `localStorage` (or other storage) usage in `src/` or `index.html`. | grep of `src/`, `index.html` (no matches) |
| Pre-render script | **Not present.** `index.html` loads only the module entry; nothing runs before React mounts. | `index.html:9-12` |
| App mount | `App` is mounted in `StrictMode`. | `src/main.tsx:6-10` |
| Existing focus style to reuse | `.counter` has a `:focus-visible` outline of `2px solid var(--accent)` with `2px` offset. | `src/App.css:14-17` |
| Existing transitions | `.counter` transitions `border-color 0.3s`; social links transition `box-shadow 0.3s`. No `prefers-reduced-motion` handling exists. | `src/App.css:8`, `src/App.css:128` |
| Dependencies | Only `react` and `react-dom` at runtime; no state, routing, or UI library. | `package.json:12-15` |
| Tests | **No test runner.** Scripts are `dev`, `build`, `lint`, `preview` only; no test files in the repo. | `package.json:6-11` |
| Token contrast (computed) | Light: `--text` on `--bg` 5.73:1, `--accent` on `--bg` **4.39:1** (below 4.5:1 for normal text), `--accent` on `--accent-bg` **3.83:1**, `--border` on `--bg` 1.27:1. Dark: `--text` on `--bg` 7.04:1, `--accent` on `--bg` 6.77:1, `--accent` on `--accent-bg` 5.35:1, `--border` on `--bg` 1.36:1. | values from `src/index.css:2-9`, `src/index.css:35-42` (WCAG relative-luminance formula) |
| Other specs | None; `docs/specs/` did not exist before this spec. | — |

## 3. User problems
- **P-1:** Users whose OS is set to light but who prefer a dark interface (for example, working at night) can't get dark mode in FeatureForge without changing their whole OS setting, and the reverse is true for users who want light on a dark OS.
- **P-2:** There is no visible control for the theme, so users don't know a dark theme exists or how to reach it.
- **P-3:** Any theme preference would be lost on reload, forcing users to re-select it every visit (relevant once a choice exists).

## 4. Goals
- **G-1:** From any page state, a user can switch between light and dark with one activation of a control in the header, by mouse, touch, or keyboard. (P-1, P-2)
- **G-2:** After a reload, the app renders in the theme the user last chose, with no visible flash of the other theme. (P-3)
- **G-3:** Users who never touch the toggle see the same theme as today (their OS preference). (No regression.)
- **G-4:** Every part of the existing UI, including icons, native controls and focus outlines, renders correctly and meets WCAG 2.2 AA contrast in both themes.

## 5. Scope
**In scope**
- A new application header landmark at the top of the page that contains the theme toggle.
- A two-state toggle: light ↔ dark.
- Default theme on first visit (no saved choice) taken from the OS `prefers-color-scheme` setting.
- Saving the user's explicit choice in the browser and restoring it on reload.
- Making every existing theme-dependent style (tokens, the social-icon invert rule, native `color-scheme`) follow the selected theme, not only the OS.
- Graceful behavior when browser storage is unavailable.

**Non-goals**
- A third "System" option in the toggle, or a way to clear a saved choice from the UI (see Q-1).
- Additional themes (high contrast, sepia, custom colors).
- Syncing the theme between open tabs in real time.
- Syncing the theme across devices or to any server/account.
- Redesigning the existing page content or changing its existing token values, except where needed to meet G-4.
- Adding other header content (navigation, logo, title) beyond what's needed to host the toggle (see Q-2).
- Restructuring the rest of the page into `<main>` and other landmarks (worth doing, but a separate change).
- Adding a test runner (separate spec; see section 13).

## 6. Assumptions
- **A-1:** Defaulting to the OS preference on first visit is what the user wants, because it matches today's behavior (`src/index.css:33`). If not, the first-visit default becomes light (or dark) unconditionally and AC-1 changes.
- **A-2:** An explicit choice in the app should override the OS setting, including if the OS setting changes later. If the user wants OS changes to win, FR-6 changes.
- **A-3:** `localStorage` is an acceptable place to store a non-sensitive theme preference; no consent banner is required for it. If a privacy policy says otherwise, persistence needs a different mechanism.
- **A-4:** Whether an `<img>`-embedded SVG's internal `prefers-color-scheme` rule follows the page's chosen `color-scheme` or the OS differs by browser and was not verified. Verification must check the Vite logo (E-7); if it doesn't follow the chosen theme, the plan must handle it.
- **A-5:** Supported browsers are current evergreen Chrome, Edge, Firefox, and Safari (not stated anywhere in the repo).

## 7. Dependencies
| Type | Item | Status | Notes |
|------|------|--------|-------|
| Browser API | `window.localStorage` | existing (browser) | Persists the choice; may throw or be unavailable (private mode, blocked storage). |
| Browser API | `matchMedia('(prefers-color-scheme: dark)')` | existing (browser) | Determines the first-visit default and OS changes when there's no saved choice. |
| CSS | `color-scheme` property | existing (`src/index.css:20`) | Must reflect the chosen theme so native UI matches. |
| Package | none | — | No new runtime dependencies are expected. |
| Spec | Test runner (Vitest + React Testing Library) | proposed, separate spec | Needed for automated tests in section 13; not part of FF-001. |

## 8. Functional requirements
- **FR-1:** The system shall render an application header landmark at the top of the page, before the existing content, on every viewport size.
- **FR-2:** The system shall display a theme toggle inside the header that indicates which theme is currently active.
- **FR-3:** The system shall switch the entire UI between the light and dark themes when the user activates the toggle, without a page reload.
- **FR-4:** The system shall save the user's chosen theme in the browser whenever the user changes it with the toggle.
- **FR-5:** The system shall, on load, apply the saved theme if one exists and is valid; otherwise it shall apply the theme matching the OS `prefers-color-scheme` setting.
- **FR-6:** The system shall keep a saved theme in effect even if the OS color-scheme setting changes; when no theme is saved, it shall follow OS color-scheme changes while the page is open.
- **FR-7:** The system shall apply the selected theme to all theme-dependent styling, including design tokens, the social-icon treatment, and native browser UI (`color-scheme`), not only when the OS matches.
- **FR-8:** The system shall apply the correct theme before the first paint, so a reload never briefly shows the other theme.
- **FR-9:** The system shall keep the toggle working for the current page session when browser storage is unavailable or throws, without showing an error or breaking the page.
- **FR-10:** The system shall ignore a saved value that isn't a recognized theme and fall back to the OS preference.

## 9. Non-functional requirements
- **NFR-1 (Performance):** Switching themes updates the UI within one frame of activation (no network requests, no reload). The pre-paint theme step adds no noticeable delay to first render.
- **NFR-2 (Accessibility):** Meets WCAG 2.2 AA; see section 12.
- **NFR-3 (Theming):** All colors used by the header and toggle come from the CSS custom properties in `src/index.css`; no hard-coded colors (`CLAUDE.md`, Styling).
- **NFR-4 (Responsiveness):** The header and toggle are usable without horizontal scrolling from 320px viewport width up, and the toggle's target size is at least 24×24 CSS px (WCAG 2.5.8).
- **NFR-5 (Persistence and privacy):** Only the theme value (`light` or `dark`) is stored, locally in the browser; nothing is sent to a server.
- **NFR-6 (Bundle size):** No new runtime dependencies.
- **NFR-7 (Browser support):** Works in the browsers listed in A-5.
- **NFR-8 (Code quality):** Passes `npm run lint` and `npm run build` (`package.json:8-9`) and follows `CLAUDE.md` conventions.

## 10. Acceptance criteria
**AC-1** (FR-5) First visit follows OS
- **Given** no saved theme and the OS set to dark
- **When** the user opens the app
- **Then** the dark theme is applied and the toggle indicates dark; with the OS set to light, the light theme is applied and the toggle indicates light.

**AC-2** (FR-1, FR-2) Header and toggle are present
- **Given** the app is loaded at any viewport width from 320px up
- **When** the page renders
- **Then** a header landmark appears above the existing content and contains a visible theme toggle that indicates the current theme.

**AC-3** (FR-3, FR-7) Toggle switches the whole UI
- **Given** the light theme is active
- **When** the user activates the toggle
- **Then** the page background, text, headings, borders, code blocks, buttons, links, social icons, focus outlines, and native scrollbars/controls all switch to their dark appearance without a reload, and the toggle indicates dark; activating it again returns everything to light.

**AC-4** (FR-3) Keyboard operation
- **Given** keyboard focus is on the toggle
- **When** the user presses Enter or Space
- **Then** the theme switches exactly as in AC-3 and focus stays on the toggle.

**AC-5** (FR-4, FR-5) Choice persists across reload
- **Given** the user selected dark while the OS is set to light
- **When** the user reloads the page (or closes and reopens the tab)
- **Then** the app opens in dark and the toggle indicates dark; the same holds for light on a dark OS.

**AC-6** (FR-8) No flash on reload
- **Given** a saved theme that differs from the OS setting
- **When** the page is reloaded (including with CPU throttling in DevTools)
- **Then** the other theme is never visible, even briefly, before the saved theme appears.

**AC-7** (FR-6) Saved choice beats OS changes
- **Given** the user selected light and the page is open
- **When** the OS color scheme changes from light to dark
- **Then** the app stays light.

**AC-8** (FR-6) No saved choice follows OS changes
- **Given** no saved theme and the page is open in light (OS light)
- **When** the OS color scheme changes to dark
- **Then** the app switches to dark and the toggle indicates dark.

**AC-9** (FR-9) Storage unavailable
- **Given** browser storage is blocked or throws on access
- **When** the user loads the app and activates the toggle
- **Then** the app loads using the OS theme, the toggle still switches themes for the session, no error is shown, and there are no uncaught errors in the console.

**AC-10** (FR-10) Invalid saved value
- **Given** the saved theme value is something other than a recognized theme (for example `"blue"` or an empty string)
- **When** the app loads
- **Then** it applies the OS theme and works normally; the next toggle activation saves a valid value.

**AC-11** (NFR-2, NFR-4) Accessible toggle
- **Given** a screen reader user on the page
- **When** they reach the toggle
- **Then** it is announced as a button with a stable accessible name (for example "Dark mode") and its on/off state; after activation the new state is announced; it has a visible `:focus-visible` indicator and at least a 24×24px target in both themes.

**AC-12** (NFR-2, FR-7) Contrast in both themes
- **Given** each theme in turn
- **When** the header, toggle (all states: default, hover, focus) and existing content are checked with a contrast tool
- **Then** text meets 4.5:1 (3:1 for large text), and the toggle's icon, boundary (if it's the only cue that it's a control) and focus indicator meet 3:1 against adjacent colors.

### Traceability
| Requirement | Acceptance criteria |
|-------------|---------------------|
| FR-1 | AC-2 |
| FR-2 | AC-2, AC-11 |
| FR-3 | AC-3, AC-4 |
| FR-4 | AC-5 |
| FR-5 | AC-1, AC-5 |
| FR-6 | AC-7, AC-8 |
| FR-7 | AC-3, AC-12 |
| FR-8 | AC-6 |
| FR-9 | AC-9 |
| FR-10 | AC-10 |
| NFR-2, NFR-4 | AC-11, AC-12 |

## 11. Edge cases
| # | Case | Expected behavior |
|---|------|-------------------|
| E-1 | First visit, no saved theme | OS preference is used (AC-1); nothing is saved until the user activates the toggle. |
| E-2 | Storage blocked / private mode / quota error | Toggle works for the session; no error UI; no uncaught exceptions (AC-9). |
| E-3 | Corrupted or unknown saved value | Treated as no saved theme (AC-10). |
| E-4 | Rapid repeated activation (e.g. holding Enter, fast clicks) | Each activation flips the theme once; the final visible theme, toggle state and saved value all agree. |
| E-5 | OS theme changes while the page is open | Follows the OS only when no theme is saved (AC-7, AC-8). |
| E-6 | Reload / back-forward navigation | Saved theme applied before first paint, no flash (AC-6). |
| E-7 | Vite logo SVG (`src/assets/vite.svg:1`) has its own OS-based dark rule | In both themes the logo's parentheses remain visible against the background; see A-4. |
| E-8 | Social icons inverted only via OS media query (`src/index.css:48-50`) | Icons are legible in dark when dark is chosen on a light OS, and not inverted in light when light is chosen on a dark OS. |
| E-9 | Narrow viewport (320px) and 200% / 400% zoom | Header and toggle stay visible and operable with no horizontal scroll or overlap (WCAG 1.4.10). |
| E-10 | `prefers-reduced-motion: reduce` | Any theme-change transition is removed; the switch is instant. |
| E-11 | React `StrictMode` double-invoking effects in development (`src/main.tsx:7`) | The theme does not flip twice, and no duplicate storage writes or listeners remain. |
| E-12 | JavaScript disabled or failed to load | The page shows the OS-based theme as today; the toggle may be absent or inert. |
| E-13 | Windows High Contrast / `forced-colors: active` | The toggle stays visible and its state remains perceivable (not conveyed by color alone). |

## 12. Accessibility
- **Keyboard:** The toggle is a native `<button>`, reachable with Tab in a logical position (first focusable item in the header, before page content), and operable with Enter and Space.
- **Focus management:** Focus stays on the toggle after activation; no focus is moved or lost when the theme changes. Visible `:focus-visible` indicator in both themes, consistent with `.counter` (`src/App.css:14-17`) and at least 3:1 against adjacent colors.
- **Semantics (roles, names, states):** Header uses the `<header>` element (banner landmark). Toggle has a constant accessible name and exposes its state with `aria-pressed` kept in sync with the active theme (or an equivalent native pattern chosen in the plan). The name must not contradict the state (avoid labels like "Switch to light" combined with `aria-pressed`). Any icon inside is decorative (`aria-hidden="true"`), and the state is not conveyed by color alone.
- **Contrast (light and dark):** Meets AC-12. Note: light `--accent` on `--bg` is 4.39:1 and on `--accent-bg` is 3.83:1 (section 2), so accent-colored **text** on the toggle would fail 4.5:1 in light mode; the plan must use a passing token pair or adjust the token. Borders (`--border`, ~1.3:1) can't be the only visual cue that the toggle is a control.
- **Announcements:** State change is announced via the button's state (`aria-pressed`); no additional live region is needed unless the plan's pattern requires one.
- **Motion:** No theme-change animation is required. Any transition added is disabled under `prefers-reduced-motion: reduce`.
- **Target size:** At least 24×24 CSS px (WCAG 2.5.8).
- **Language:** The toggle's text/name is in English, matching `lang="en"` (`index.html:2`).

## 13. Test plan
**Test tooling:** No test runner in the repo (`package.json:6-11`); automated tests depend on a separate spec that adds Vitest + React Testing Library. Until then, verification is manual plus `npm run lint` and `npm run build`.

| # | Level (unit / component / e2e / manual) | Scenario | Covers |
|---|------------------------------------------|----------|--------|
| T-1 | unit (after runner) | Initial-theme resolution: valid saved value wins; missing or invalid value falls back to OS; storage throwing falls back to OS | AC-1, AC-5, AC-9, AC-10 |
| T-2 | unit (after runner) | Saving a theme writes the value; a throwing storage is swallowed | AC-5, AC-9 |
| T-3 | component (after runner) | Header renders as `banner`; toggle found with `getByRole('button', { name })`; `aria-pressed` reflects the theme and flips on click and on Enter/Space; focus stays on the toggle | AC-2, AC-4, AC-11 |
| T-4 | component (after runner) | Mocked `matchMedia` change: theme follows OS only when nothing is saved | AC-7, AC-8 |
| T-5 | manual | Clear storage; set OS to dark, load, confirm dark; set OS to light, load, confirm light | AC-1 |
| T-6 | manual | Toggle by mouse and by keyboard (Tab, Enter, Space); inspect every listed area (background, text, code, counter, links, social icons, Vite logo, scrollbar) in both themes | AC-3, AC-4, E-7, E-8 |
| T-7 | manual | Choose the theme opposite to the OS, reload with DevTools CPU throttling 6×, and watch for a flash; repeat for back/forward | AC-5, AC-6 |
| T-8 | manual | With a theme saved, toggle OS dark/light (DevTools rendering emulation): app doesn't change. Clear storage, repeat: app follows | AC-7, AC-8 |
| T-9 | manual | Block site storage (browser settings) and repeat T-6; check the console for errors | AC-9, E-2 |
| T-10 | manual | Set the saved value to `"blue"` in DevTools, reload | AC-10, E-3 |
| T-11 | manual | Screen reader (NVDA + Firefox or Chrome on Windows; VoiceOver + Safari if available): name, role, state, and state-change announcement | AC-11 |
| T-12 | manual | Contrast check of header, toggle states and focus ring in both themes (DevTools or axe) | AC-12 |
| T-13 | manual | 320px width, 200% and 400% zoom, reduced motion emulation, forced-colors emulation, rapid repeated activation | E-4, E-9, E-10, E-13 |
| T-14 | automated gate | `npm run lint` and `npm run build` pass | NFR-8 |

## 14. Open questions
- **Q-1:** Should users be able to go back to "follow my OS" after choosing a theme (a third "System" state, or a reset)? This spec assumes **no** (two-state toggle; non-goal), meaning that once a user toggles, OS changes no longer apply.
- **Q-2:** What else, if anything, should the new header contain (app name "FeatureForge", logo)? This spec assumes only what's needed to host the toggle; the plan may add the app name as plain text if you agree.
- **Q-3:** Visual form of the toggle: icon-only button (sun/moon) with an accessible name, a labeled switch, or text button? Behavior and semantics are fixed by this spec; the look is open.
- **Q-4:** Should a theme change animate (e.g. a short color fade), or switch instantly? This spec assumes instant.
- **Q-5:** Should the theme sync across open tabs when changed in one? Currently a non-goal.
- **Q-6:** Do you want the test-runner spec (Vitest + React Testing Library) done before FF-001 is implemented, so T-1 to T-4 can be automated, or after?

## 15. Next step
Review this spec. Once it's approved, write the implementation plan. No code until both are approved.
