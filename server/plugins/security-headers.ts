import { setHeader } from 'h3'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:"
].join('; ')

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    setHeader(event, 'Content-Security-Policy', CONTENT_SECURITY_POLICY)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'X-Frame-Options', 'DENY')
    setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
    setHeader(
      event,
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
    setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  })
})
