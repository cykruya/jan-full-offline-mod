import { useId, useState, useRef } from 'react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { predefinedProviders } from '@/constants/providers'
import { getProviderTitle } from '@/lib/utils'
import ProvidersAvatar from '@/containers/ProvidersAvatar'

interface AddProviderDialogProps {
  onCreateProvider: (
    name: string,
    baseUrl: string,
    apiKey: string,
    apiType: ProviderApiType
  ) => void
  children: React.ReactNode
}

const URL_PATTERN = /^https?:\/\/[^\s]+$/i

export function AddProviderDialog({
  onCreateProvider,
  children,
}: AddProviderDialogProps) {
  const { t } = useTranslation()
  const nameInputId = useId()
  const [preset, setPreset] = useState<ProviderObject>()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiType, setApiType] = useState<ProviderApiType>('openai')
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const selectPreset = (next?: ProviderObject) => {
    setPreset(next)
    setName(next?.provider ?? '')
    setBaseUrl(next?.base_url ?? '')
    setApiType(next?.api_type ?? 'openai')
    setError(null)
  }

  const reset = () => {
    setPreset(undefined)
    setName('')
    setBaseUrl('')
    setApiKey('')
    setApiType('openai')
    setError(null)
  }

  const handleCreate = () => {
    const trimmedName = name.trim()
    const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
    const trimmedApiKey = apiKey.trim()
    if (!trimmedName || !trimmedBaseUrl || !trimmedApiKey) return
    if (!URL_PATTERN.test(trimmedBaseUrl)) {
      setError(t('provider:invalidBaseUrl'))
      return
    }
    onCreateProvider(trimmedName, trimmedBaseUrl, trimmedApiKey, apiType)
    reset()
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) reset()
  }

  const canSubmit =
    name.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    apiKey.trim().length > 0
  const baseUrlPlaceholder =
    apiType === 'anthropic'
      ? t('provider:baseUrlPlaceholderAnthropic')
      : t('provider:baseUrlPlaceholder')

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        data-testid="add-provider-dialog"
        className="sm:max-w-[460px] max-w-[90vw]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          nameInputRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('provider:addProvider')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t('provider:presetLabel')}
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="provider-preset-trigger" variant="outline" className="w-full justify-between rounded-md">
                  {preset ? (
                    <div className="flex min-w-0 items-center gap-2 leading-5">
                      <ProvidersAvatar provider={preset} />
                      <span className="min-w-0 truncate">{getProviderTitle(preset)}</span>
                    </div>
                  ) : (
                    <span>{t('provider:presetCustom')}</span>
                  )}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                <DropdownMenuItem onSelect={() => selectPreset()}>
                  <span>{t('provider:presetCustom')}</span>
                </DropdownMenuItem>
                {(predefinedProviders as ProviderObject[]).map((p) => (
                  <DropdownMenuItem key={p.provider} data-testid={`provider-preset-${p.provider}`} onSelect={() => selectPreset(p)}>
                    <div className="flex min-w-0 items-center gap-2 leading-5">
                      <ProvidersAvatar provider={p} />
                      <span className="min-w-0 truncate">{getProviderTitle(p)}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={nameInputId}
              className="text-xs text-muted-foreground"
            >
              {t('provider:nameLabel')}
            </label>
            <Input
              id={nameInputId}
              data-testid="provider-name-input"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('provider:enterNameForProvider')}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">
              {t('provider:apiTypeLabel')}
            </label>
            <RadioGroup
              value={apiType}
              onValueChange={(v) => setApiType(v as ProviderApiType)}
              className="flex flex-row gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="openai" />
                {t('provider:apiTypeOpenAI')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="anthropic" />
                {t('provider:apiTypeAnthropic')}
              </label>
            </RadioGroup>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t('provider:baseUrlLabel')}
            </label>
            <Input
              data-testid="provider-base-url-input"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                if (error) setError(null)
              }}
              placeholder={baseUrlPlaceholder}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t('provider:apiKeyLabel')}
            </label>
            <Input
              data-testid="provider-api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('provider:apiKeyPlaceholder')}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
            />
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-2">
          <DialogClose asChild>
            <Button
              variant="link"
              size="sm"
              className="hover:no-underline w-full sm:w-auto"
            >
              {t('common:cancel')}
            </Button>
          </DialogClose>
          <Button
            data-testid="add-provider-submit"
            disabled={!canSubmit}
            onClick={handleCreate}
            className="w-full sm:w-auto"
            size="sm"
            aria-label={t('common:create')}
          >
            {t('common:create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
