import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/sensorDataAnalyzer/', // <-- ADD OR MODIFY THIS LINE
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      stream: 'stream-browserify',
    },
  },
})