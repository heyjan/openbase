export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/editor')) {
    return
  }

  const authFetch = process.server ? useRequestFetch() : $fetch

  if (to.path === '/editor/login') {
    try {
      await authFetch('/api/auth/editor-me')
      return navigateTo('/editor')
    } catch {
      return
    }
  }

  try {
    await authFetch('/api/auth/editor-me')
  } catch {
    return navigateTo('/editor/login')
  }
})
