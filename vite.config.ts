import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => {
  const base = process.env.MUSIC_TOOL_BASE ?? '/'

  return {
    base,
    plugins: [
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
        start_url: base,
        scope: base,
        lang: 'zh-Hant',
        icons: [
          { src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: `${base}icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
    ],
  }
})
