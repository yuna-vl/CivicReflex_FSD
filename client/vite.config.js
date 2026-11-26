import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'CivicReflex',
        short_name: 'CivicReflex',
        description: 'Citizen civic services and accountability portal',
        theme_color: '#0B2545',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
  { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})