import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const installerName = 'Anaconda3-2025.12-2-Windows-x86_64.exe'
const downloadsAnacondaPattern = /Anaconda3-.*\.exe$/i

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // changed from 127.0.0.1
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    watch: {
      ignored: (filePath: string) => {
        if (!filePath) return false
        const normalized = filePath.replace(/\\/g, '/')
        if (normalized.includes('/node_modules/') || normalized.includes('/.git/')) return true
        if (normalized.endsWith('/' + installerName)) return true
        if (downloadsAnacondaPattern.test(path.basename(normalized))) return true
        if (normalized.includes('/Downloads/') && /Anaconda3-.*\.exe$/i.test(normalized)) return true
        return false
      }
    }
  }
})