/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// https://vite.dev/config/
export default defineConfig({
  base: '/perflab/',
  define: {
    __BUILD_HASH__: JSON.stringify(execSync('git rev-parse --short HEAD').toString().trim()),
  },
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
