export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/editor')) {
    return
  }

  const authFetch = process.server ? useRequestFetch() : $fetch
  const authOptions = process.server ? undefined : ({ credentials: 'include' } as const)

  if (to.path === '/editor/login') {
    try {
      await authFetch('/api/auth/editor-me', authOptions)
      return navigateTo('/editor')
    } catch {
      return
    }
  }

  try {
    await authFetch('/api/auth/editor-me', authOptions)
  } catch {
    return navigateTo('/editor/login')
  }
})
