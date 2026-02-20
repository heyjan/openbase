import type { AdminUser } from '~/types/admin'

export const useAdmins = () => {
  const list = () => $fetch<AdminUser[]>('/api/admin/admins')

  const create = (payload: {
    email: string
    name: string
    password: string
  }) =>
    $fetch<AdminUser>('/api/admin/admins', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: Partial<AdminUser> & { password?: string }) =>
    $fetch<AdminUser>(`/api/admin/admins/${id}`, {
      method: 'PUT',
      body: payload
    })

  return {
    list,
    create,
    update
  }
}
