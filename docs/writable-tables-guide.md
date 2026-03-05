# Writable Tables — Complete Guide

## Overview

Writable Tables allow **editors** (non-admin users) to insert and update data directly in your PostgreSQL tables through a web UI. This is useful for manual data entry, corrections, or allowing dashboard viewers to contribute data.

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

Once logged in, the editor sees two main sections:

#### 3.1 Dashboards (`/editor` or `/editor/dashboards`)
- Lists all dashboards the editor has been granted access to
- Clicking a dashboard opens `/editor/dashboards/{slug}`
- The dashboard renders with the same `DashboardGrid` and `DashboardFilterBar` as the admin view
- Editors can **view** dashboard data but the dashboard itself is read-only

#### 3.2 Data Entry (`/editor/data-entry`)
- Lists all writable tables the editor has permission to edit
- Clicking a table opens `/editor/data-entry/{tableId}`

The **Data Entry UI** for each table provides:

**Current Rows Display**
- Shows up to 50 existing rows in the table
- Columns are filtered by the `allowedColumns` config

**Insert Form** (if `allowInsert` is enabled)
- One input field per column in the table schema
- Input types are auto-detected:
  - Boolean → dropdown (true/false/empty)
  - Date → date picker
  - Number → number input
  - Text → text input
- Submit inserts a new row via `POST /api/editor/writable-tables/{id}/insert`

**Update Form** (if `allowUpdate` is enabled)
- Select which column to update (SET clause)
- Enter the new value
- Select a WHERE column (to identify which rows to update)
- Enter the WHERE value
- Submit updates matching rows via `PUT /api/editor/writable-tables/{id}/update`

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
   - Go to `/editor/data-entry` — you should see the writable table listed
   - Click it to open the data entry form
   - **Test Insert**: Fill in name, email, score, active → Submit
   - **Test Update**: Select column `score`, enter new value, WHERE column `name`, WHERE value = the name you inserted → Submit
   - Verify in the rows display that the data was inserted/updated

6. **Verify in the database**:
   ```sql
   SELECT * FROM test_writable;
   ```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Editor can't see any tables | Missing permission | Admin > Editors > Permissions — check the writable table |
| "Insert not allowed" error | `allowInsert` is off | Edit the writable table config and enable it |
| Column not showing in form | Not in `allowedColumns` | Update the writable table's allowed columns list |
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
| Data Entry List | `app/pages/editor/data-entry/index.vue` |
| Data Entry Form | `app/pages/editor/data-entry/[id].vue` |
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
