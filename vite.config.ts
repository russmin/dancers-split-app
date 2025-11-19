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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Don't split React - keep it in main bundle for reliability
          // Only split other large dependencies
          if (id.includes('node_modules')) {
            // Keep React in main bundle - don't split it
            if (id.includes('/react/') || id.includes('/react-dom/') || 
                id.includes('\\react\\') || id.includes('\\react-dom\\')) {
              // Return undefined to keep in main bundle
              return;
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
