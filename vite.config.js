import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Isolate Monaco Editor and its loader runtime
            if (id.includes('@monaco-editor') || id.includes('monaco-editor') || id.includes('state-local')) {
              return 'vendor-monaco';
            }
            // Isolate jQuery
            if (id.includes('jquery')) {
              return 'vendor-jquery';
            }
            // React and React Router core framework
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('react-router-dom') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react';
            }
            // Other third-party dependencies
            return 'vendor-libs';
          }
        }
      }
    }
  }
});
