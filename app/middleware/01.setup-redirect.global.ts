export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/api')) {
    return
  }

  const fetchFn = process.server ? useRequestFetch() : $fetch
  const { required } = await fetchFn<{ required: boolean }>('/api/setup/status')

  if (required && !to.path.startsWith('/setup')) {
    return navigateTo('/setup')
  }

  if (!required && to.path.startsWith('/setup')) {
    return navigateTo('/admin')
  }
})
