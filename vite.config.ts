import { sites } from '@openai/sites-vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    sites(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['audio/*.wav'],
      manifest: {
        name: 'Music Tool',
        short_name: 'Music Tool',
        description: '個人音樂練習工具',
        theme_color: '#171a21',
        background_color: '#f4efe6',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-Hant',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
