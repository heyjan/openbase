import { query } from './db'

let queryOrganizationSchemaReady = false
let queryOrganizationSchemaReadyPromise: Promise<void> | null = null

export const ensureQueryOrganizationSchema = async () => {
  if (queryOrganizationSchemaReady) {
    return
  }

  if (queryOrganizationSchemaReadyPromise) {
    await queryOrganizationSchemaReadyPromise
    return
  }

  queryOrganizationSchemaReadyPromise = (async () => {
    await query(
      `CREATE TABLE IF NOT EXISTS query_folders (
         id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         name       VARCHAR(255) NOT NULL,
         sort_order INT DEFAULT 0,
         created_at TIMESTAMPTZ DEFAULT now(),
         updated_at TIMESTAMPTZ DEFAULT now()
       )`
    )

    await query(
      `CREATE TABLE IF NOT EXISTS visualization_folders (
         id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         name       VARCHAR(255) NOT NULL,
         created_at TIMESTAMPTZ DEFAULT now(),
         updated_at TIMESTAMPTZ DEFAULT now()
       )`
    )

    await query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'saved_queries'
             AND column_name = 'folder_id'
         ) THEN
           ALTER TABLE saved_queries
           ADD COLUMN folder_id UUID REFERENCES query_folders(id) ON DELETE SET NULL;
         END IF;
       END $$;`
    )

    await query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'query_visualizations'
             AND column_name = 'folder_id'
         ) THEN
           ALTER TABLE query_visualizations
           ADD COLUMN folder_id UUID REFERENCES visualization_folders(id) ON DELETE SET NULL;
         END IF;
       END $$;`
    )

    queryOrganizationSchemaReady = true
  })()

  try {
    await queryOrganizationSchemaReadyPromise
  } finally {
    queryOrganizationSchemaReadyPromise = null
  }
}
