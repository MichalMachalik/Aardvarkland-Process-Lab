import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:4188' } },
});
