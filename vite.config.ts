import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Production-only Content Security Policy: scripts only from this site, network only to our Supabase project. */
function csp(supabaseUrl: string | undefined): Plugin {
  const api = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' data: blob: ${api}`.trim(),
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the app from /mayaplingo/; locally it's served from /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    csp(loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'MayapLingo — Learn Kapampangan',
        short_name: 'MayapLingo',
        description: 'Learn to speak Kapampangan, the language of Pampanga, one small lesson at a time.',
        theme_color: '#58cc02',
        background_color: '#ffffff',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Recordings are not precached (hundreds of files); each is cached the first time it's played.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        runtimeCaching: [
          {
            // Serve the cached copy instantly, refresh it in the background so re-recordings reach users.
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mayaplingo-audio', expiration: { maxEntries: 1000 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'mayaplingo-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
}))
