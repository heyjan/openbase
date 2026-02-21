import type { ShareLink } from '~/types/share-link'

export const useShareLinks = () => {
  const list = () =>
    $fetch<ShareLink[]>('/api/admin/share-links')

  const revoke = (token: string) =>
    $fetch<{ ok: true }>(`/api/admin/share-links/${token}`, {
      method: 'DELETE'
    })

  return {
    list,
    revoke
  }
}
