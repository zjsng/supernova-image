import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact({
    prerender: {
      enabled: true,
      renderTarget: '#app',
      additionalPrerenderRoutes: ['/supernova-image/404'],
    }
  })],
  root: 'src',
  base: '/supernova-image/',
  build: { outDir: '../dist', emptyOutDir: true }
})
