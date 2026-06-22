import { describe, it, expect, vi, beforeEach } from 'vitest'

// H5: provider API keys move to the OS keychain on Win/macOS, with a
// localStorage fallback (Linux + web build). These tests mock the Rust
// secret_* bridge and the registry, then exercise hydrateProviderKeys,
// setProviderApiKey, migration, and the localStorage-strip via partialize.
//
// `keychainReady` is module-level state, so each case re-imports the store
// fresh (vi.resetModules) to start from a clean "not yet probed" flag.

const { secretGet, secretSet, secretDelete } = vi.hoisted(() => ({
  secretGet: vi.fn(),
  secretSet: vi.fn(),
  secretDelete: vi.fn(),
}))

vi.mock('../../api/providers/registry', () => ({ clearProviderCache: vi.fn() }))
vi.mock('../../api/backend', () => ({ secretGet, secretSet, secretDelete }))

async function freshStore() {
  vi.resetModules()
  const mod = await import('../providerStore')
  return mod.useProviderStore
}

const obf = (k: string) => btoa(k.split('').reverse().join(''))

// The default vitest env here is 'node' (no DOM). zustand persist needs a
// localStorage; install a minimal Map-backed one BEFORE the store module loads
// (createJSONStorage reads it at import time, which freshStore triggers).
function installLocalStorage() {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => { map.clear() },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size },
  })
}

describe('providerStore keychain (H5)', () => {
  beforeEach(() => {
    secretGet.mockReset()
    secretSet.mockReset()
    secretDelete.mockReset()
    installLocalStorage()
  })

  it('no keychain (secret_get rejects on first probe) → stays on localStorage, never writes the vault', async () => {
    secretGet.mockRejectedValue(new Error('keychain unavailable (web build)'))
    const useStore = await freshStore()
    await useStore.getState().hydrateProviderKeys()

    useStore.getState().setProviderApiKey('anthropic', 'sk-test')
    expect(secretSet).not.toHaveBeenCalled()
    // getter still works via the obfuscated localStorage path
    expect(useStore.getState().getProviderApiKey('anthropic')).toBe('sk-test')
  })

  it('loads a key stored in the vault into memory', async () => {
    secretGet.mockImplementation(async (id: string) => (id === 'anthropic' ? 'sk-vault' : null))
    const useStore = await freshStore()
    await useStore.getState().hydrateProviderKeys()
    expect(useStore.getState().getProviderApiKey('anthropic')).toBe('sk-vault')
  })

  it('after hydrate, setProviderApiKey writes the real key to the vault', async () => {
    secretGet.mockResolvedValue(null)
    secretSet.mockResolvedValue(undefined)
    const useStore = await freshStore()
    await useStore.getState().hydrateProviderKeys()

    useStore.getState().setProviderApiKey('openai', 'sk-new')
    expect(secretSet).toHaveBeenCalledWith('openai', 'sk-new')
  })

  it('migrates an existing localStorage key into the vault on hydrate', async () => {
    secretGet.mockResolvedValue(null) // vault empty
    secretSet.mockResolvedValue(undefined)
    const useStore = await freshStore()

    // Seed a key the old way BEFORE hydrate (keychain not yet active).
    useStore.getState().setProviderApiKey('anthropic', 'sk-old-localstorage')
    expect(secretSet).not.toHaveBeenCalled() // not active yet
    secretSet.mockClear()

    await useStore.getState().hydrateProviderKeys()
    expect(secretSet).toHaveBeenCalledWith('anthropic', 'sk-old-localstorage')
  })

  it('after hydrate, partialize strips the key from persisted localStorage', async () => {
    secretGet.mockImplementation(async (id: string) => (id === 'anthropic' ? 'sk-vault' : null))
    secretSet.mockResolvedValue(undefined)
    const useStore = await freshStore()
    await useStore.getState().hydrateProviderKeys()

    const raw = localStorage.getItem('lu-providers') || ''
    expect(raw).not.toContain('sk-vault')
    expect(raw).not.toContain(obf('sk-vault'))
  })

  it('resetProvider deletes the key from the vault when active', async () => {
    secretGet.mockResolvedValue(null)
    secretSet.mockResolvedValue(undefined)
    secretDelete.mockResolvedValue(undefined)
    const useStore = await freshStore()
    await useStore.getState().hydrateProviderKeys()

    useStore.getState().resetProvider('anthropic')
    expect(secretDelete).toHaveBeenCalledWith('anthropic')
  })
})
