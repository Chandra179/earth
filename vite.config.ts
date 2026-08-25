import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  "/api": {
    target: process.env.BACKEND_URL || "http://localhost:8076",
    changeOrigin: true,
  },

  "/proxy/giss": {
    target: "https://data.giss.nasa.gov",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/giss/, ""),
  },
  "/proxy/nsidc": {
    target: "https://noaadata.apps.nsidc.org",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/nsidc/, ""),
  },
  "/proxy/inpe": {
    target: "https://terrabrasilis.dpi.inpe.br",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/inpe/, ""),
  },
  "/proxy/firms": {
    target: "https://firms.modaps.eosdis.nasa.gov",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/firms/, ""),
  },
  "/proxy/openaq": {
    target: "https://api.openaq.org",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/openaq/, ""),
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
