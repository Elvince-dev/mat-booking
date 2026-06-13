import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const installerName = 'Anaconda3-2025.12-2-Windows-x86_64.exe'
const downloadsAnacondaPattern = /Anaconda3-.*\.exe$/i

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Ignore node_modules/.git and any Anaconda installer files in Downloads
      ignored: (filePath: string) => {
        if (!filePath) return false
        const normalized = filePath.replace(/\\/g, '/')
        if (normalized.includes('/node_modules/') || normalized.includes('/.git/')) return true
        if (normalized.endsWith('/' + installerName)) return true
        if (downloadsAnacondaPattern.test(path.basename(normalized))) return true
        // Also ignore if the path contains 'Downloads' and an Anaconda installer
        if (normalized.includes('/Downloads/') && /Anaconda3-.*\.exe$/i.test(normalized)) return true
        return false
      }
    }
  }
})
