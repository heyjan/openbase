export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) {
    return
  }

  if (to.path === '/admin/login') {
    return
  }

  try {
    const authFetch = process.server ? useRequestFetch() : $fetch
    await authFetch('/api/auth/me')
  } catch {
    return navigateTo('/admin/login')
  }
})
