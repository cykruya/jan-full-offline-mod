import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localStorageKey } from '@/constants/localStorage'
import { backendStorage } from '@/lib/backendStorage'
import { getServiceHub } from '@/hooks/useServiceHub'

/**
 * An API format the websearch plugin speaks. Each entry doubles as the preset
 * of the service it is named after: applying it fills in `presetUrl` as the
 * address.
 */
export type WebSearchProviderMeta = {
  id: string
  label: string
  /** The plugin backend that speaks this format. */
  backend: string
  /** Keyring record of the API key; empty when the format takes no key. */
  secretKey: string
  presetUrl: string
}

export const WEB_SEARCH_PROVIDERS: WebSearchProviderMeta[] = [
  { id: 'exa-mcp', label: 'Exa MCP', backend: 'exa', secretKey: '', presetUrl: 'https://mcp.exa.ai' },
  { id: 'exa', label: 'Exa', backend: 'exa', secretKey: 'exa-api-key', presetUrl: 'https://api.exa.ai' },
  { id: 'tavily', label: 'Tavily', backend: 'tavily', secretKey: 'tavily-api-key', presetUrl: 'https://api.tavily.com' },
  { id: 'searxng', label: 'SearXNG', backend: 'searxng', secretKey: '', presetUrl: 'http://localhost:8080' },
  { id: 'you-mcp', label: 'You.com MCP', backend: 'you', secretKey: '', presetUrl: 'https://api.you.com' },
  { id: 'you', label: 'You.com', backend: 'you', secretKey: 'you-api-key', presetUrl: 'https://ydc-index.io' },
  { id: 'yacy', label: 'YaCy', backend: 'yacy', secretKey: '', presetUrl: 'http://localhost:8090' },
  { id: 'duckduckgo', label: 'DuckDuckGo', backend: 'duckduckgo', secretKey: '', presetUrl: 'https://html.duckduckgo.com' },
  { id: 'bing', label: 'Bing', backend: 'bing', secretKey: '', presetUrl: 'https://www.bing.com' },
  { id: 'yandex', label: 'Yandex', backend: 'yandex', secretKey: 'yandex-api-key', presetUrl: 'https://searchapi.api.cloud.yandex.net' },
]

export const DEFAULT_SEARCH_PROVIDER = 'exa'

export const getProviderMeta = (id: string): WebSearchProviderMeta =>
  WEB_SEARCH_PROVIDERS.find((p) => p.id === id) ?? WEB_SEARCH_PROVIDERS[0]

type WebSearchConfigState = {
  webSearchEnabled: boolean
  searchProvider: string
  apiKeys: Record<string, string>
  endpoints: Record<string, string>
  setWebSearchEnabled: (value: boolean) => void
  setSearchProvider: (value: string) => void
  setApiKey: (providerId: string, value: string) => void
  setEndpoint: (providerId: string, value: string) => void
}

export const useWebSearchConfig = create<WebSearchConfigState>()(
  persist(
    (set, get) => ({
      webSearchEnabled: false,
      searchProvider: DEFAULT_SEARCH_PROVIDER,
      apiKeys: {},
      endpoints: {},
      setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
      setSearchProvider: (searchProvider) => set({ searchProvider }),
      setApiKey: (providerId, value) => {
        set({ apiKeys: { ...get().apiKeys, [providerId]: value } })
        const secretKey = getProviderMeta(providerId).secretKey
        if (!secretKey) return
        // Canonical secret store is the OS keyring, not settings.json.
        getServiceHub()
          .core()
          .invoke('set_secret', { key: secretKey, value })
          .catch((err) =>
            console.warn('Failed to persist web search API key to keyring:', err)
          )
      },
      // Addresses are not secrets; they persist in settings.json.
      setEndpoint: (providerId, value) =>
        set({ endpoints: { ...get().endpoints, [providerId]: value } }),
    }),
    {
      name: localStorageKey.settingWebSearch,
      storage: createJSONStorage(() => backendStorage),
      skipHydration: true,
      // Never write API keys to plaintext settings.json; they live in the keyring.
      partialize: (state) => ({
        webSearchEnabled: state.webSearchEnabled,
        searchProvider: state.searchProvider,
        endpoints: state.endpoints,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        for (const provider of WEB_SEARCH_PROVIDERS) {
          if (!provider.secretKey) continue
          getServiceHub()
            .core()
            .invoke<string | null>('get_secret', { key: provider.secretKey })
            .then((value) => {
              if (!value) return
              useWebSearchConfig.setState((s) => ({
                apiKeys: { ...s.apiKeys, [provider.id]: value },
              }))
            })
            .catch(() => {})
        }
      },
    }
  )
)
