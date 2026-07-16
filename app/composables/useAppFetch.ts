export const useAppFetch = createUseFetch((currentOptions) => ({
  ...currentOptions,
  $fetch: currentOptions.$fetch ?? (process.server ? useRequestFetch() : $fetch)
}))
