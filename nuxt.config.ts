import { DESIGN_FONT_FAMILIES } from './shared/design-settings'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@nuxtjs/mdc', '@nuxt/fonts'],
  experimental: {
    normalizeComponentNames: true,
    payloadExtraction: 'client'
  },
  ui: {
    fonts: false
  },
  fonts: {
    provider: 'google',
    families: DESIGN_FONT_FAMILIES.map(name => ({ name, global: true })),
    defaults: {
      weights: [400, 500, 600, 700],
      styles: ['normal']
    }
  },
  css: ['~/assets/css/main.css', 'gridstack/dist/gridstack.min.css']
})
