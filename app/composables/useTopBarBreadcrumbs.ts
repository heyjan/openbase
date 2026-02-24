import type { BreadcrumbItem } from '~/components/ui/Breadcrumbs.vue'

export const useTopBarBreadcrumbs = () => {
  const topBarBreadcrumbs = useState<BreadcrumbItem[]>(
    'top-bar-breadcrumbs',
    () => []
  )

  const setTopBarBreadcrumbs = (items: BreadcrumbItem[] = []) => {
    topBarBreadcrumbs.value = items
  }

  return {
    topBarBreadcrumbs,
    setTopBarBreadcrumbs
  }
}
