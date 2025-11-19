import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'], // Ensure React is not duplicated
  },
  build: {
    chunkSizeWarningLimit: 1000, // Adjust warning limit (in KB)
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Ensure React and React-DOM are always together and loaded first
          if (id.includes('node_modules')) {
            // Match React more precisely
            if (id.includes('/react/') || id.includes('/react-dom/') || 
                id.includes('\\react\\') || id.includes('\\react-dom\\') ||
                id.includes('/react/index.js') || id.includes('/react-dom/index.js')) {
              return 'react-vendor';
            }
            if (id.includes('framer-motion') || id.includes('recharts')) {
              return 'ui-vendor';
            }
            if (id.includes('@radix-ui')) {
              return 'radix-vendor';
            }
            // Other node_modules go into a vendor chunk
            return 'vendor';
          }
          // Separate large components into their own chunks (handled by lazy loading)
          if (id.includes('/Progress/ProgressTab')) {
            return 'progress';
          }
          if (id.includes('/components/LibraryTab')) {
            return 'library';
          }
        },
      },
    },
  },
})
