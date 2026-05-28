import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useSettingsStore } from './stores/settingsStore'

function App() {
  useEffect(() => {
    // In Tauri: show the window once React has rendered (window starts hidden)
    if (window.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('show_window').catch(() => {})
      })
    }

    // Bug BB v2.5.0 — push persisted GPU selection from localStorage into
    // AppState at app boot so the next Ollama / ComfyUI spawn picks it up
    // without the user having to open Settings first. Read the setting
    // synchronously off the store (already hydrated from localStorage by
    // zustand persist middleware).
    if (window.__TAURI_INTERNALS__) {
      const s = useSettingsStore.getState().settings
      const selection = {
        vendor: s.gpuVendor || 'auto',
        indices: s.gpuIndices || [],
      }
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('set_gpu_selection', { selection }).catch(() => {})
      })
    }
  }, [])

  return <AppShell />
}

export default App
