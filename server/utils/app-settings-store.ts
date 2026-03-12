import type { DesignSettings } from '~~/shared/design-settings'
import {
  DEFAULT_DESIGN_SETTINGS,
  coerceDesignSettings
} from '~~/shared/design-settings'
import { query } from './db'

type AppSettingsRow = {
  value: unknown
}

type SharedLinkLogoSettings = {
  logo?: unknown
}

let ensureAppSettingsTablePromise: Promise<void> | null = null

const ensureAppSettingsTable = async () => {
  if (!ensureAppSettingsTablePromise) {
    ensureAppSettingsTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS app_settings (
           id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           key         VARCHAR(100) UNIQUE NOT NULL,
           value       JSONB NOT NULL,
           updated_at  TIMESTAMPTZ DEFAULT now()
         )`
      )
    })()
  }

  await ensureAppSettingsTablePromise
}

export const getDesignSettings = async (): Promise<DesignSettings> => {
  await ensureAppSettingsTable()

  const result = await query<AppSettingsRow>(
    `SELECT value
     FROM app_settings
     WHERE key = 'design'
     LIMIT 1`
  )

  const row = result.rows[0]
  if (!row) {
    return DEFAULT_DESIGN_SETTINGS
  }

  return coerceDesignSettings(row.value)
}

export const saveDesignSettings = async (settings: DesignSettings) => {
  await ensureAppSettingsTable()

  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('design', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now()`,
    [JSON.stringify(settings)]
  )
}

export const getSharedLinkLogo = async (): Promise<string | null> => {
  await ensureAppSettingsTable()

  const result = await query<AppSettingsRow>(
    `SELECT value
     FROM app_settings
     WHERE key = 'shared_link_logo'
     LIMIT 1`
  )

  const row = result.rows[0]
  if (!row || !row.value || typeof row.value !== 'object') {
    return null
  }

  const logo = (row.value as SharedLinkLogoSettings).logo
  if (typeof logo !== 'string' || !logo.length) {
    return null
  }

  return logo
}

export const saveSharedLinkLogo = async (dataUri: string) => {
  await ensureAppSettingsTable()

  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('shared_link_logo', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now()`,
    [JSON.stringify({ logo: dataUri })]
  )
}

export const deleteSharedLinkLogo = async () => {
  await ensureAppSettingsTable()

  await query(
    `DELETE FROM app_settings
     WHERE key = 'shared_link_logo'`
  )
}
