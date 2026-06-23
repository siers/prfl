/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/perflab/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    // jsdom for the component-render tests (Randomize). The pure-logic tests
    // run fine under it too, so it's set globally rather than per-file.
    environment: 'jsdom',
  },
})
