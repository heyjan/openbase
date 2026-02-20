export default defineNuxtRouteMiddleware(async (to) => {
  if (!process.client) {
    return
  }

  if (to.path.startsWith('/api')) {
    return
  }

  const { required } = await $fetch<{ required: boolean }>('/api/setup/status')

  if (required && !to.path.startsWith('/setup')) {
    return navigateTo('/setup')
  }

  if (!required && to.path.startsWith('/setup')) {
    return navigateTo('/admin')
  }
})
