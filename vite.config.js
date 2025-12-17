import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'index.html'),
        background: path.resolve(__dirname, 'src/background/index.js'),
        contentSearch: path.resolve(__dirname, 'src/content/searchScraper.js'),
        contentProduct: path.resolve(__dirname, 'src/content/productScraper.js'),
        contentAdvancedSearch: path.resolve(__dirname, 'src/content/advancedSearchScraper.js'),
        contentSeller: path.resolve(__dirname, 'src/content/sellerAutomation.js'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
