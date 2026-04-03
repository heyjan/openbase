# Openbase Feature Guide

This document is the detailed feature reference for Openbase.

## 1. Setup and Access

- First-run setup flow initializes the first administrator account.
- Magic-link based admin onboarding with password completion.
- Session-based authentication for protected admin and editor areas.
- Dedicated editor login flow and workspace isolation from admin controls.

## 2. Dashboard Authoring

- Canvas-based dashboard builder with drag-and-resize module placement.
- Configurable module system for structured dashboard composition.
- Text modules (`header`, `subheader`) to organize sections and narrative flow.
- Dashboard save and update workflows through server-side APIs.

## 3. Query and Visualization Workflows

- Query-centric dashboard modules for connecting saved queries to visuals.
- Visualization configuration support for multiple chart/table patterns.
- Dashboard-focused editing experience designed for iterative analysis.

Reference: `documentation/query-visualization-options-spec.md`

## 4. Data Source Integrations

Openbase supports multiple database backends for analytics use cases:

- PostgreSQL: query execution, table browsing, controlled write workflows.
- MySQL: read-only query and browsing support.
- DuckDB: read-only access using file paths or in-memory mode.
- SQLite: read-only file-based access.
- MongoDB: collection listing and row/document browsing.

Data source management includes admin-driven connection setup and data browsing interfaces.

## 5. Role-Based Access Control (RBAC)

- Separate admin and editor roles with distinct permissions and entry points.
- Admin-managed editor accounts.
- Dashboard-level access assignment to editors.
- Writable-table permission assignment for controlled editor data updates.

Reference: `documentation/database-integration-rbac-spec.md`

## 6. Controlled Data Writing

For PostgreSQL workflows, admins can define which tables are writable:

- Supports governed INSERT/UPDATE operations.
- Restricts editing to explicitly allowed tables and editor assignments.
- Designed for safe operational updates directly from dashboards.

## 7. Sharing and Distribution

- Tokenized public links for dashboard sharing.
- Read-only public dashboard presentation.
- PDF export support for external distribution and reporting.

Reference: `documentation/pdf-export-spec.md`

## 8. Security Hardening

- API payload sanitization to reduce injection risk.
- Security headers for browser hardening (CSP and related headers).
- Route-level rate limiting for auth and sensitive flows.
- Audit log entries for login/logout and editor write activity.
- Encryption support for persisted data-source credentials.

Reference: `documentation/security-spec-setup-bypass.md`

## 9. Admin Experience

- Sidebar-driven quick-action navigation for core admin workflows.
- Home area with analytics-oriented tools and operational entry points.
- Settings and management surfaces for user and data source administration.

Reference: `documentation/admin-home-sidebar-spec.md`

## 10. Testing and Delivery

- Playwright end-to-end coverage for critical application flows.
- Containerized local runtime with Podman compose.
- SQL schema bootstrap support through `db/schema.sql`.

## 11. Technical Scope Snapshot

- Frontend framework: Nuxt 4 + Vue 3 + TypeScript.
- Backend model: Nuxt server routes under `server/api/**`.
- Database backbone: PostgreSQL plus additional read-oriented connectors.
- Deployment model: container-first local stack with documented production hardening path.
