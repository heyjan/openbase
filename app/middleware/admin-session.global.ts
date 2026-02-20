export default defineNuxtRouteMiddleware(async (to) => {
  if (!process.client) {
    return
  }

  if (!to.path.startsWith('/admin')) {
    return
  }

  if (to.path === '/admin/login') {
    return
  }

  try {
    await $fetch('/api/auth/me')
  } catch {
    return navigateTo('/admin/login')
  }
})
