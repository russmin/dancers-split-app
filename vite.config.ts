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
          // Keep React and React-dependent libraries in main bundle
          if (id.includes('node_modules')) {
            // Don't split React - keep it in main bundle
            if (id.includes('/react/') || id.includes('/react-dom/') || 
                id.includes('\\react\\') || id.includes('\\react-dom\\') ||
                id.includes('react/index') || id.includes('react-dom/index')) {
              // Return undefined to keep in main bundle
              return;
            }
            // framer-motion requires React, so keep it with React in main bundle
            if (id.includes('framer-motion')) {
              return; // Keep in main bundle with React
            }
            // Radix UI components also need React - keep in main bundle
            if (id.includes('@radix-ui')) {
              return; // Keep in main bundle to ensure React is available
            }
            if (id.includes('recharts')) {
              return 'ui-vendor';
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
