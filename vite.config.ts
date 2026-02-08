import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { ADDITIONAL_PRERENDER_ROUTES } from './src/lib/seo-routes'

export default defineConfig({
  plugins: [preact({
    prerender: {
      enabled: true,
      renderTarget: '#app',
      additionalPrerenderRoutes: ADDITIONAL_PRERENDER_ROUTES,
    }
  })],
  root: 'src',
  base: '/supernova-image/',
  build: { outDir: '../dist', emptyOutDir: true }
})
