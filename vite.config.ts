import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: '.',
    plugins: [
      // Polyfill common Node globals and modules for browser usage
      nodePolyfills({
        protocolImports: true,
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
      react(),
    ],
    define: {
      __VITE_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL),
      __VITE_SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      __VITE_FRONTEND_URL__: JSON.stringify(env.VITE_FRONTEND_URL),
      __VITE_STRIPE_PUBLIC_KEY__: JSON.stringify(env.VITE_STRIPE_PUBLIC_KEY),
      global: 'globalThis',
    },
    optimizeDeps: {
      exclude: ['fs'],
      include: [
        'lucide-react',
        'winston',
        '@tiptap/extension-text-align',
        '@tiptap/extension-highlight',
        '@tiptap/extension-color',
        '@tiptap/extension-task-list',
        '@tiptap/extension-task-item',
        '@tiptap/extension-code-block-lowlight',
        '@tiptap/extension-table',
        '@tiptap/extension-table-row',
        '@tiptap/extension-table-cell',
        '@tiptap/extension-table-header',
        'lowlight',
      ],
    },
    build: {
      target: 'esnext', // Fixed: use a valid esbuild target
      rollupOptions: {
        external: []
      }
    }
  };
});