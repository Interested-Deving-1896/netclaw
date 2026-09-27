import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hudPorts, createLocalAccess, localAccessMiddleware } from './src/security/local-access.js';

const ports = hudPorts();
const localOnly = () => ({
  name: 'netclaw-local-access',
  configureServer(server) { server.middlewares.use(localAccessMiddleware(createLocalAccess(ports))); },
  configurePreviewServer(server) { server.middlewares.use(localAccessMiddleware(createLocalAccess(ports))); },
});

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [localOnly(), react()],
  build: {
    rollupOptions: {
      input: {
        hud: resolve(rootDir, 'index.html'),
        canvas: resolve(rootDir, 'canvas.html'),
      },
    },
  },
  preview: { host: '127.0.0.1', port: ports.ui, strictPort: true },
  server: {
    host: '127.0.0.1',
    port: ports.ui,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${ports.api}`,
        timeout: 300000,
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, _req, res) => {
            // Keep socket alive for 5 minutes (gateway may run many tools)
            res.setTimeout(300000);
          });
        },
      },
      '/ws': {
        target: `ws://127.0.0.1:${ports.api}`,
        ws: true,
      },
    },
  },
});
