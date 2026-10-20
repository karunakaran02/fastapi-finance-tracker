## Mandatory Rules:

1. Strict Zero Comments: Never add comments (`//`, `#`, `/* */`, `{/* */}`, `<!-- -->`) or docstrings (`"""..."""`) in code files.
2. Strict Zero Console Logs: Do not add `console.log` statements in frontend files.
3. No Inline Styles for Static CSS: Move all component styling to dedicated, co-located `.css` stylesheets. Use CSS custom properties (`--var`) only for purely dynamic values.
4. Theme Parity: Ensure complete UI readability and high contrast in both Dark and Light themes (`html[data-theme="light"]`).
5. Precision Math: Always use `Decimal` for currency calculations in Python/FastAPI.
6. Alembic Migrations: All database schema changes require Alembic migrations committed to Git.
