// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@nuxtjs/google-fonts'],
  googleFonts: {
    families: {
      Inter: [400, 500, 600, 700],
      'IBM Plex Sans': [400, 500, 600, 700],
      'Source Sans 3': [400, 500, 600, 700]
    },
    display: 'swap',
    preload: true
  },
  css: ['~/assets/css/main.css', '~/assets/css/gridstack.css'],
  vite: {
    plugins: [tailwindcss()]
  }
})
