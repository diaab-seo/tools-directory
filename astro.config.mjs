import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'server',                  // on-demand SSR via Cloudflare
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    },
    assets: {
      binding: 'CF_ASSETS'
    }
  }),
  integrations: [tailwind(), sitemap()],
  site: 'https://aipromptsmall.shop',
  trailingSlash: 'always',
});