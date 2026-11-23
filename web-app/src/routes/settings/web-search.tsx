import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import HeaderPage from '@/containers/HeaderPage'
import SettingsMenu from '@/containers/SettingsMenu'
import { Card, CardItem } from '@/containers/Card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { Input } from '@/components/ui/input'
import { EyeOff, Eye, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  useWebSearchConfig,
  WEB_SEARCH_PROVIDERS,
  getProviderMeta,
  type WebSearchProviderMeta,
} from '@/hooks/useWebSearchConfig'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.web_search as any)({
  component: WebSearchContent,
})

type ProviderMenuProps = {
  label: string
  selected?: string
  testId: string
  onSelect: (provider: WebSearchProviderMeta) => void
}

const ProviderMenu = ({ label, selected, testId, onSelect }: ProviderMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="justify-between gap-2" data-testid={testId}>
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground ml-2" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      {WEB_SEARCH_PROVIDERS.map((p) => (
        <DropdownMenuItem key={p.id} className={cn('cursor-pointer my-0.5', selected === p.id && 'bg-secondary-foreground/8')} onClick={() => onSelect(p)}>
          <span className="truncate">{p.label}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

function WebSearchContent() {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)
  const {
    webSearchEnabled,
    searchProvider,
    apiKeys,
    endpoints,
    setWebSearchEnabled,
    setSearchProvider,
    setApiKey,
    setEndpoint,
  } = useWebSearchConfig()

  const provider = getProviderMeta(searchProvider)
  const apiKey = apiKeys[provider.id] ?? ''
  const endpoint = endpoints[provider.id] ?? ''
  const applyPreset = (preset: WebSearchProviderMeta) => {
    setSearchProvider(preset.id)
    setEndpoint(preset.id, preset.presetUrl)
  }

  return (
    <div className="flex flex-col h-svh w-full">
      <HeaderPage>
        <div className="flex items-center gap-2 w-full">
          <span className="font-medium text-base font-studio">
            {t('common:settings')}
          </span>
        </div>
      </HeaderPage>
      <div className="flex h-[calc(100%-60px)]">
        <SettingsMenu />
        <div className="p-4 pt-0 w-full overflow-y-auto">
          <div className="flex flex-col justify-between gap-4 gap-y-3 w-full">
            <Card
              header={
                <div className="flex items-center justify-between">
                  <h1 className="text-foreground font-studio font-medium text-base mb-2">
                    {t('settings:webSearch.title')}
                  </h1>
                  <Switch
                    checked={webSearchEnabled}
                    onCheckedChange={setWebSearchEnabled}
                  />
                </div>
              }
            >
              <CardItem
                title={t('settings:webSearch.enable')}
                description={t('settings:webSearch.enableDesc')}
              />
              <CardItem
                title={t('settings:webSearch.preset')}
                description={t('settings:webSearch.presetDesc')}
                actions={<ProviderMenu label={t('settings:webSearch.presetChoose')} testId="web-search-preset" onSelect={applyPreset} />}
              />
              <CardItem
                title={t('settings:webSearch.format')}
                description={t('settings:webSearch.formatDesc')}
                actions={<ProviderMenu label={provider.label} selected={provider.id} testId="web-search-format" onSelect={(p) => setSearchProvider(p.id)} />}
              />
              <CardItem
                title={t('settings:webSearch.address')}
                className="block"
                description={
                  <div className="space-y-2">
                    <p>{t('settings:webSearch.addressDesc')}</p>
                    <Input type="text" className="w-full" data-testid="web-search-address" placeholder={provider.presetUrl} value={endpoint} onChange={(e) => setEndpoint(provider.id, e.target.value)} />
                  </div>
                }
              />
              {provider.secretKey && (
                <CardItem
                  title={t('settings:webSearch.apiKey', {
                    provider: provider.label,
                  })}
                  className="block"
                  description={
                    <div className="space-y-2">
                      <p>
                        {t(
                          provider.id === 'yandex'
                            ? 'settings:webSearch.apiKeyYandex'
                            : 'settings:webSearch.apiKeyRequired',
                          { provider: provider.label }
                        )}
                      </p>
                      <div className="relative">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          className="w-full pr-16"
                          placeholder={t(
                            'settings:webSearch.apiKeyPlaceholder',
                            { provider: provider.label }
                          )}
                          value={apiKey}
                          onChange={(e) =>
                            setApiKey(provider.id, e.target.value)
                          }
                        />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                          <button
                            onClick={() => setShowKey(!showKey)}
                            className="p-1 rounded hover:bg-foreground/5 text-foreground/70"
                          >
                            {showKey ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
