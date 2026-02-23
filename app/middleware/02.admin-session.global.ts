export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) {
    return
  }

  if (to.path === '/admin/login') {
    return
  }

  const authFetch = process.server ? useRequestFetch() : $fetch

  try {
    await authFetch('/api/auth/me')
  } catch {
    try {
      const { required } = await authFetch<{ required: boolean }>('/api/setup/status')
      return navigateTo(required ? '/setup' : '/admin/login')
    } catch {
      return navigateTo('/admin/login')
    }
  }
})
