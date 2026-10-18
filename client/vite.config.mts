import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/Teddy-Bud/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
  },
  optimizeDeps: {
    exclude: ['react-native-safe-area-context'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
