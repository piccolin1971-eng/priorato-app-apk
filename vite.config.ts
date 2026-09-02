import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    watch: {
      // Profilo Chrome/Edge locale: non deve entrare nel file watcher di Vite
      ignored: ['**/.priorato-browser/**', '**/priorato-server.log'],
    },
  },
})
