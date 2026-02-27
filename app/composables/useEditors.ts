import type { EditorPermissionsResponse, EditorUser } from '~/types/editor'

export const useEditors = () => {
  const list = () => $fetch<EditorUser[]>('/api/admin/editors')

  const create = (payload: {
    email: string
    name: string
    password: string
    is_active?: boolean
  }) =>
    $fetch<EditorUser>('/api/admin/editors', {
      method: 'POST',
      body: payload
    })

  const update = (
    id: string,
    payload: Partial<EditorUser> & {
      password?: string
    }
  ) =>
    $fetch<EditorUser>(`/api/admin/editors/${id}`, {
      method: 'PUT',
      body: payload
    })

  const getPermissions = (id: string) =>
    $fetch<EditorPermissionsResponse>(`/api/admin/editors/${id}/permissions`)

  const updatePermissions = (
    id: string,
    payload: {
      dashboardIds: string[]
      writableTableIds: string[]
    }
  ) =>
    $fetch<{ dashboardIds: string[]; writableTableIds: string[] }>(
      `/api/admin/editors/${id}/permissions`,
      {
        method: 'PUT',
        body: payload
      }
    )

  return {
    list,
    create,
    update,
    getPermissions,
    updatePermissions
  }
}
