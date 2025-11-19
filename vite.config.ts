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
          // Only split lazy-loaded components
          // Keep all node_modules in main bundle to ensure React is always available
          if (id.includes('/Progress/ProgressTab')) {
            return 'progress';
          }
          if (id.includes('/components/LibraryTab')) {
            return 'library';
          }
          // Keep everything else (including React and all dependencies) in main bundle
          return;
        },
      },
    },
  },
})
