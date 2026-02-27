import { query } from './db'

export type AuditActorType = 'admin' | 'editor' | 'system'

export const createAuditEntry = async (input: {
  actorId?: string | null
  actorType: AuditActorType
  action: string
  resource?: string | null
  details?: Record<string, unknown>
  ipAddress?: string | null
}) => {
  await query(
    `INSERT INTO audit_log (actor_id, actor_type, action, resource, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.actorId ?? null,
      input.actorType,
      input.action,
      input.resource ?? null,
      input.details ?? {},
      input.ipAddress ?? null
    ]
  )
}
