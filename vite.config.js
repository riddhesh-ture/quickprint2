import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
            if (id.includes('recharts')) {
              return 'recharts-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            // Put @mui and @emotion together before react match to avoid @emotion/react going into react-vendor
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui-vendor';
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/') ||
              id.includes('/react-router-dom/')
            ) {
              return 'react-vendor';
            }
          }
        },
      },
    },
  },
});