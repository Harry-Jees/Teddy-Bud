import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/Teddy-Bud/' : '/',
  plugins: [
    react(),
    {
      name: 'stub-react-native-svg-touch-sound-on-web',
      enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('/NativeSvgSoundModule') || id.endsWith('/NativeSvgSoundModule.js')) {
          return '\0rnsvg-sound-stub';
        }
        return null;
      },
      load(id) {
        if (id === '\0rnsvg-sound-stub') return 'export default { playTouchSound() {} };';
        return null;
      },
    },
  ],
  build: {
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: 'react-native', replacement: 'react-native-web' },
      {
        find: 'react-native-svg',
        replacement: fileURLToPath(new URL('./node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js', import.meta.url)),
      },
      { find: '@', replacement: fileURLToPath(new URL('.', import.meta.url)) },
    ],
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
