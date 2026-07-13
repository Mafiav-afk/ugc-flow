import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createApp } from './server/app.mjs'

const localApi = {
  name: 'ugc-flow-local-api',
  configureServer(server) {
    server.middlewares.use(createApp({ apiOnly: true }))
  },
}

export default defineConfig({
  base: './',
  plugins: [react(), localApi],
  server: { host: '127.0.0.1', port: 5173 },
})
