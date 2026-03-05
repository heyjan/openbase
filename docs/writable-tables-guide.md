# Writable Tables — Complete Guide

## Overview

Writable Tables allow **editors** (non-admin users) to insert and update data directly in your PostgreSQL tables through dashboard and API workflows. This is useful for manual data entry, corrections, or allowing dashboard viewers to contribute data.

---

## End-to-End Flow

### Phase 1: Admin Configuration

#### 1.1 Add a PostgreSQL Data Source
- Go to **Admin > Data Sources**
- Add a PostgreSQL connection (only PostgreSQL is supported for writable tables)
- Ensure the connection has write access to the target table

#### 1.2 Create the Target Table
- Create the table in your PostgreSQL database that you want editors to write to
- Example: `CREATE TABLE manual_entries (id SERIAL PRIMARY KEY, name TEXT, value NUMERIC, created_at TIMESTAMPTZ DEFAULT now())`

#### 1.3 Configure a Writable Table
- Go to **Admin > Settings > Writable Tables** (`/admin/settings/writable-tables`)
- Click "Add Writable Table"
- Select the **Data Source** (must be PostgreSQL)
- Enter the **Table Name** (e.g., `manual_entries` or `schema.table_name`)
- **Allowed Columns** (optional): Comma-separated list of columns the editor can write to. Leave empty to allow all columns.
- **Allow Insert**: Toggle on/off (default: on)
- **Allow Update**: Toggle on/off (default: on)
- **Description**: Optional description for editors

#### 1.4 Create an Editor User
- Go to **Admin > Editors** (`/admin/editors`)
- Click "Add Editor"
- Enter **email**, **name**, and **password**
- The editor account is separate from admin accounts

#### 1.5 Set Permissions
- On the Editors page, click **"Permissions"** for the editor
- This takes you to `/admin/editors/{id}`
- **Dashboard Access**: Check the dashboards the editor can view
- **Writable Table Access**: Check the writable tables the editor can edit
- Click **Save**

> Permissions are atomic — all dashboard and table permissions are replaced on save.

---

### Phase 2: Editor Login

The editor has a completely separate login flow from admins:

1. Editor navigates to `/editor/login`
2. Enters email and password
3. Server validates credentials, creates a session (HttpOnly cookie, 30-day expiry)
4. Redirected to `/editor` (the editor home page)

**Important**: The editor login page is at `/editor/login`, NOT `/admin/login`. These are separate authentication systems.

---

### Phase 3: Editor Experience

Once logged in, the editor works from assigned dashboards:

#### 3.1 Dashboards (`/editor` and `/editor/dashboards/{slug}`)
- Lists all dashboards the editor has been granted access to
- Clicking a dashboard opens `/editor/dashboards/{slug}`
- The dashboard renders with the same `DashboardGrid` and `DashboardFilterBar` as the admin view
- If a table module is linked to a writable table and permissions allow updates, configured columns are inline-editable
- Saving an edited cell calls `PUT /api/editor/writable-tables/{id}/update`
- Non-editable columns remain read-only

#### 3.2 Insert Workflow
- Insert operations are available through `POST /api/editor/writable-tables/{id}/insert` when `allowInsert` is enabled
- Payload values must match configured allowed columns and column types

---

## How to Test

### Quick Test Checklist

1. **Create a test table** in your PostgreSQL database:
   ```sql
   CREATE TABLE test_writable (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT,
     score INTEGER,
     active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. **Configure the writable table** in Admin > Settings > Writable Tables:
   - Data Source: your PostgreSQL source
   - Table Name: `test_writable`
   - Allowed Columns: `name, email, score, active` (exclude `id` and `created_at` since they auto-fill)
   - Allow Insert: on
   - Allow Update: on

3. **Create a test editor** in Admin > Editors:
   - Email: `test@example.com`
   - Name: `Test Editor`
   - Password: (something secure)

4. **Set permissions** — click Permissions on the editor:
   - Check the writable table you just created
   - Optionally check a dashboard for them to view
   - Save

5. **Test the editor flow**:
   - Open a private/incognito browser window
   - Navigate to `/editor/login`
   - Log in with the editor credentials
   - Open an assigned dashboard at `/editor/dashboards/{slug}`
   - In a linked table module, edit an allowed cell inline and save
   - Verify the updated value appears after refresh
   - **Optional API insert check**: call `POST /api/editor/writable-tables/{id}/insert` with editor auth cookie

6. **Verify in the database**:
   ```sql
   SELECT * FROM test_writable;
   ```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Editor can't edit cells | Missing dashboard/table permission or no writable table linked to module | Admin > Editors > Permissions and module `config.writableTableId` |
| "Insert not allowed" error | `allowInsert` is off | Edit the writable table config and enable it |
| Column is not editable inline | Not in `allowedColumns` or updates disabled | Update `allowedColumns` and ensure `allowUpdate` is enabled |
| Editor login fails | Account inactive or wrong credentials | Check `is_active` flag in Admin > Editors |
| "Data source not found" error | Source deleted or inactive | Verify the data source exists and is active |

---

## Architecture Reference

### Key Files

| Component | Path |
|-----------|------|
| **Admin Pages** | |
| Writable Tables Settings | `app/pages/admin/settings/writable-tables.vue` |
| Editors Management | `app/pages/admin/editors.vue` |
| Editor Permissions | `app/pages/admin/editors/[id].vue` |
| **Editor Pages** | |
| Editor Login | `app/pages/editor/login.vue` |
| Editor Home (Dashboards) | `app/pages/editor/index.vue` |
| Dashboard View | `app/pages/editor/dashboards/[slug].vue` |
| Inline Edit Composable | `app/composables/useInlineCellEdit.ts` |
| Data Table Renderer | `app/components/modules/DataTable.vue` |
| **Server APIs** | |
| Admin Writable Tables CRUD | `server/api/admin/writable-tables/` |
| Admin Editors CRUD | `server/api/admin/editors/` |
| Editor Auth | `server/api/auth/editor-*.ts` |
| Editor Writable Tables | `server/api/editor/writable-tables/` |
| Editor Dashboards | `server/api/editor/dashboards/` |
| **Server Utils** | |
| Writable Table Store | `server/utils/writable-table-store.ts` |
| Permission Store | `server/utils/permission-store.ts` |
| Write Validators | `server/utils/write-validators.ts` |
| Write Query Builder | `server/utils/write-query-builder.ts` |
| Editor Auth Middleware | `server/middleware/editor-auth.ts` |

### Security

- **Authentication**: Separate session system for editors (bcrypt passwords, 30-day session tokens)
- **Authorization**: Every API call checks `editor_table_permissions` / `editor_dashboard_access`
- **SQL Injection Prevention**: All queries use parameterized values
- **Column Restriction**: `allowedColumns` limits which columns can be written to
- **Type Validation**: All input values are validated and coerced per column data type
- **Audit Logging**: All insert/update operations are logged with editor ID, action, and details
