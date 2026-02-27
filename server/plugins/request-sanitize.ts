import { getMethod, readBody } from 'h3'
import { sanitizeInput } from '~~/server/utils/sanitize'

const PAYLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const ParsedBodySymbol = Symbol.for('h3ParsedBody')

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    const path = event.path || ''
    if (!path.startsWith('/api/')) {
      return
    }

    const method = getMethod(event)
    if (!PAYLOAD_METHODS.has(method)) {
      return
    }

    const body = await readBody(event, { strict: false })
    if (body === undefined || body === null) {
      return
    }

    const sanitized = sanitizeInput(body)
    ;(event.node.req as Record<PropertyKey, unknown>)[ParsedBodySymbol] = sanitized
  })
})
