## 1. Comment & Logging Hygiene

- Strict Zero Comments Policy:
  - No single-line comments (`//`, `#`).
  - No multi-line/block comments (`/* ... */`, `{/* ... */}`).
  - No HTML comments (`<!-- ... -->`).
  - No Python docstrings (`"""..."""` or `'''...'''`) in functions, classes, or modules.
  - Code must be self-explanatory with clean naming conventions, explicit type annotations, and transparent logic.
- Zero Console Logs:
  - No `console.log`, `console.debug`, `console.warn`, or `console.info` statements in frontend source code.
  - User feedback must be surfaced through UI alert banners, status pills, or modal notifications.

---

## 2. Frontend Architecture & CSS Standards

- Zero Inline Styles for Static CSS:
  - Never use inline `style={{ ... }}` for static styling (such as flexbox, grid, margins, paddings, typography, borders, and background colors).
  - All component and page styling must be placed in dedicated, co-located `.css` files (e.g. `TransactionsPage.css`, `RecurringPage.css`, `SettingsPage.css`, `Sidebar.css`).
- Dynamic Values via CSS Custom Properties:
  - For runtime values (e.g. progress bar widths, user-chosen ledger colors), pass CSS custom properties via `style={{ '--progress-width': `${percent}%` }}` and define the property implementation in the respective CSS stylesheet.
- Theme Support (Dark & Light):
  - Every component must look crisp and high-contrast in both Dark and Light themes.
  - Light theme styling must be handled via `html[data-theme="light"]` selectors and semantic CSS variables (`var(--bg-surface)`, `var(--text-primary)`, `var(--border-color)`).
  - Do not use hardcoded dark utility classes with opacity modifiers (e.g. `bg-surface-container/70` or `bg-slate-900`) without explicit light-theme overrides.
- Icons:
  - Use Google Material Symbols Outlined vector icons (`material-symbols-outlined`) or Lucide icons.
  - Do not use raw Unicode emojis for financial categories, accounts, or stream books.
- SPA Routing & Assets:
  - Any new page route added in `App.jsx` must be included in `finance_web/scripts/generate-spa-routes.js` to ensure Nginx serves `index.html` on direct browser URL refreshes.
  - After modifying frontend files, compile production assets via `npm run build` and sync to the container.

---

## 3. Backend & API Standards

- Framework & Runtime: Python 3.12+ with FastAPI, SQLAlchemy 2.0, and Pydantic v2.
- Financial Precision:
  - Always use `Decimal` (from Python `decimal` module) and SQLAlchemy `Numeric(precision=12, scale=2)` for all monetary transactions, balances, thresholds, and calculations.
  - Never use floating-point types (`float`) for currency math to prevent IEEE-754 rounding errors.
- Database Migrations (Alembic):
  - All database schema updates must include an Alembic migration script under `finance_api/migrations/versions/`.
  - Migration files must be committed to Git.
  - Migration downgrade procedures (`downgrade()`) must be fully implemented and reversible.
- Automated Testing:
  - All new endpoints, models, or service methods must have corresponding pytest test cases in `finance_api/tests/`.
  - All tests must pass before committing (`docker exec finance_api pytest -q`).

---

## 4. Git & Commit Protocol

- Author & Identity:
  - Name: `Karunakaran`
  - Email: `karankarunakaran6@gmail.com`
- Conventional Commits:
  - Use structured commit prefixes: `feat:`, `fix:`, `refactor:`, `style:`, `test:`, `chore:`.
- Pre-commit Verification:
  - Ensure zero comments and zero `console.log` statements are present across all staged files.
  - Ensure working tree is clean and push to `origin main` immediately after committing.
