import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
  integrations: [tailwind()],
  site: 'https://pomelosmp.example.com',
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    ssr: {
      // @libsql/client ships native .node bindings; keep it external so Vite won't try to bundle them
      external: ['@libsql/client', 'libsql'],
    },
    optimizeDeps: {
      exclude: ['@libsql/client', 'libsql'],
    },
  },
});
