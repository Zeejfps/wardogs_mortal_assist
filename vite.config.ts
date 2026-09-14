import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The version shown in the app, so a bug report can say which build it came
 * from. Releases are git tags, so the tag is the source of truth: the deploy
 * workflow has it in GITHUB_REF_NAME, and a local build asks git, which
 * gives "2.5.0-3-g1efbb6a-dirty" for anything past the last tag.
 */
function appVersion(): string {
  const ref = process.env.GITHUB_REF_NAME;
  if (ref && /^v\d/.test(ref)) return ref.slice(1);
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().replace(/^v/, '');
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    svelte(),
    VitePWA({
      // Precache every built asset (hashed filenames) plus the icons below, and
      // swap in a new service worker as soon as one is published. Together that
      // replaces the old hand-stamped cache name: a new deploy changes the
      // hashes, so an installed phone picks it up on its next launch.
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-180.png'],
      manifest: {
        name: 'Mortar Calculator',
        short_name: 'Mortar',
        description: 'Tiny mortar range calculator',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#14171c',
        theme_color: '#14171c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        // Map tiles are hosted separately and far too big to precache. Every
        // tile that is viewed is kept, so the areas you have looked at work
        // offline. Tiles are fetched with CORS so only real 200s are cached:
        // an opaque entry is padded to megabytes for quota purposes. Three
        // maps at full depth are about 16k tiles / 200 MB.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/wardogsmaps\.builtbyzee\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 20000, maxAgeSeconds: 180 * 24 * 3600, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
});
