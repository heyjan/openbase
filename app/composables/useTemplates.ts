import type { ModuleTemplate, ModuleTemplateInput } from '~/types/template'

export const useTemplates = () => {
  const list = () =>
    $fetch<ModuleTemplate[]>('/api/admin/templates')

  const create = (payload: ModuleTemplateInput) =>
    $fetch<ModuleTemplate>('/api/admin/templates', {
      method: 'POST',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/templates/${id}`, {
      method: 'DELETE'
    })

  return {
    list,
    create,
    remove
  }
}
