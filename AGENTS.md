# Repository Guidelines

## Project Structure & Module Organization
`openbase` is a Nuxt 4 app with a filesystem-driven frontend and backend:
- `app/`: UI code (`pages/`, `components/`, `composables/`, `types/`, `middleware/`, `assets/css/main.css`).
- `server/`: API routes and backend utilities (`server/api/**`, `server/utils/**`, `server/plugins/**`).
- `db/`: PostgreSQL schema (`db/schema.sql`) plus local SQLite artifacts used for data-source exploration.
- `public/`: static assets.
- `documentation/`: canonical location for all specs and technical docs

Use feature-local organization where possible (for example, dashboard logic stays under `app/components/dashboard` and matching routes under `server/api/admin/dashboards`).

## UI Notice
- Breadcrumb navigation is rendered in the global top bar (left side), not inside page content.
- Set breadcrumbs via `PageHeader` `breadcrumbs` prop (or `useTopBarBreadcrumbs()` for pages not using `PageHeader`).
- Do not add explanatory/helper copy in frontend forms, modals, or empty states unless explicitly requested in the task/spec. Default to concise labels and actions only.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: run Nuxt dev server (default `http://localhost:3000`).
- `npm run build`: production build; use as the primary pre-PR verification step.
- `npm run preview`: serve the production build locally.
- `npm run generate`: generate static output when needed.
- `docker-compose up --build`: start app + PostgreSQL with schema bootstrap for full local stack.

Set `DATABASE_URL` for non-Docker local runs (see `README.md`).

## Coding Style & Naming Conventions
- Language stack: TypeScript + Vue SFC.
- Indentation: 2 spaces; keep formatting aligned with surrounding files.
- Components: PascalCase filenames (for example, `DashboardEditor.vue`).
- Nuxt route files: filesystem naming (`[id].put.ts`, `[slug].vue`) to define params/methods.
- Identifiers: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants.

No dedicated ESLint/Prettier config is committed; consistency with existing code is required.

## Testing Guidelines

### E2E Tests (Playwright)
End-to-end tests live in `e2e/` and use [Playwright](https://playwright.dev/) with Chromium.

**Setup (once, inside the devcontainer or toolbox):**
```bash
npm run playwright:install   # downloads Chromium + system deps
```

**Running tests:**
```bash
npm run test:e2e             # headless run
npm run test:e2e:headed      # opens a visible browser
npm run test:e2e:ui          # interactive Playwright UI
```

The Playwright config (`playwright.config.ts`) auto-starts the Nuxt dev server when not in CI. Set `BASE_URL` to override the target (default `http://localhost:3000`).

**Writing tests:**
- Place test files in `e2e/` with `*.spec.ts` naming.
- Group related tests with `test.describe()`.
- Keep tests independent — each test should not depend on state from another.

### General
- Run `npm run build` before every PR.
- Manually verify critical flows: setup, admin auth, dashboard editing/sharing, and data-source browsing.
- For unit tests (future), prefer `*.test.ts` naming and colocate by feature (for example, `server/**/__tests__`).

## Commit & Pull Request Guidelines
Current history is minimal (`Initial commit`), so use clear imperative commits going forward.
- Preferred format: `type(scope): summary` (example: `fix(auth): reject inactive admins`).
- Keep commits focused and logically grouped.

PRs should include:
- What changed and why.
- Linked issue/spec reference from `documentation/` (for example, `documentation/spec.md` section when relevant).
- Verification steps run.
- UI screenshots/GIFs for frontend changes.
- Notes for schema/env changes (`db/schema.sql`, `DATABASE_URL`).

## Security & Configuration Tips
- Do not commit secrets or production credentials.
- Keep connection strings in environment variables.
- Treat `db/*.db*` files as local/dev artifacts, not source-of-truth data.
