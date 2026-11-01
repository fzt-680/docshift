import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          pdf: ['pdfjs-dist'],
          doc: ['mammoth', 'docx', 'marked', 'turndown'],
          office: ['xlsx', 'papaparse', 'jszip'],
        },
      },
    },
  },
})
