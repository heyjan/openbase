export type AnnotationInput = {
  asin?: string
  product_group?: string
  event_date?: string
  author_name: string
  note: string
  tags?: string[]
}

export const useAnnotations = () => {
  const create = async (
    slug: string,
    token: string,
    payload: AnnotationInput
  ) => {
    return await $fetch(`/api/dashboards/${slug}/annotations`, {
      method: 'POST',
      query: { token },
      body: payload
    })
  }

  return {
    create
  }
}
