import { getHeader, type H3Event } from 'h3'

type TrustedProxyRule = {
  value: string
  prefixBits?: number
}

const IPV4_BITS = 32

const normalizeIp = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length)
  }

  return trimmed
}

const parseTrustedProxyRule = (value: string): TrustedProxyRule | null => {
  const trimmed = normalizeIp(value)
  if (!trimmed) {
    return null
  }

  const [ip, prefix] = trimmed.split('/')
  if (prefix === undefined) {
    return { value: ip }
  }

  const prefixBits = Number(prefix)
  if (
    !Number.isInteger(prefixBits) ||
    prefixBits < 0 ||
    prefixBits > IPV4_BITS ||
    ipv4ToNumber(ip) === null
  ) {
    return null
  }

  return { value: ip, prefixBits }
}

const getTrustedProxyRules = () =>
  (process.env.OPENBASE_TRUSTED_PROXIES || '')
    .split(',')
    .map(parseTrustedProxyRule)
    .filter((rule): rule is TrustedProxyRule => Boolean(rule))

const ipv4ToNumber = (value: string) => {
  const parts = value.split('.')
  if (parts.length !== 4) {
    return null
  }

  const octets = parts.map((part) => Number(part))
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index]
    )
  ) {
    return null
  }

  return octets.reduce((result, octet) => (result << 8) + octet, 0) >>> 0
}

const matchesTrustedProxyRule = (ip: string, rule: TrustedProxyRule) => {
  if (rule.prefixBits === undefined) {
    return ip === rule.value
  }

  const ipNumber = ipv4ToNumber(ip)
  const ruleNumber = ipv4ToNumber(rule.value)
  if (ipNumber === null || ruleNumber === null) {
    return false
  }

  const mask =
    rule.prefixBits === 0
      ? 0
      : (0xffffffff << (IPV4_BITS - rule.prefixBits)) >>> 0
  return (ipNumber & mask) === (ruleNumber & mask)
}

const isTrustedProxy = (ip: string, rules: TrustedProxyRule[]) =>
  rules.some((rule) => matchesTrustedProxyRule(ip, rule))

const parseForwardedFor = (event: H3Event) => {
  const header = getHeader(event, 'x-forwarded-for')
  if (!header) {
    return []
  }

  return header
    .split(',')
    .map(normalizeIp)
    .filter(Boolean)
}

export const getClientIp = (event: H3Event) => {
  const remoteIp = normalizeIp(event.node.req.socket.remoteAddress)
  const trustedProxyRules = getTrustedProxyRules()

  if (!remoteIp || !isTrustedProxy(remoteIp, trustedProxyRules)) {
    return remoteIp || null
  }

  const forwardedFor = parseForwardedFor(event)
  if (!forwardedFor.length) {
    return remoteIp
  }

  for (let index = forwardedFor.length - 1; index >= 0; index -= 1) {
    const candidate = forwardedFor[index]
    if (!isTrustedProxy(candidate, trustedProxyRules)) {
      return candidate
    }
  }

  return forwardedFor[0] ?? remoteIp
}
