import { describe, expect, it } from 'vitest'
import { predefinedProviders } from '@/constants/providers'
import { providerModels } from '@/constants/models'
import { getProviderPreset } from '../providerPresets'

describe('getProviderPreset', () => {
  it('is undefined for a name that is not a preset', () => {
    expect(getProviderPreset('my-llm-server')).toBeUndefined()
    expect(getProviderPreset('llamacpp')).toBeUndefined()
  })

  it('carries the predefined provider with its built-in models', () => {
    const preset = getProviderPreset('anthropic')
    expect(preset?.base_url).toBe('https://api.anthropic.com/v1')
    expect(preset?.api_type).toBe('anthropic')
    expect(preset?.custom_header).toEqual(expect.arrayContaining([{ header: 'anthropic-version', value: '2023-06-01' }]))
    expect(preset?.models.map((m) => m.id)).toEqual(providerModels.anthropic.models)
    expect(preset?.models[0].capabilities).toContain('completion')
  })

  it('has no built-in models where the provider lists none', () => {
    expect(getProviderPreset('openrouter')?.models).toEqual([])
  })

  it('returns a copy, so an added provider never edits the preset', () => {
    const preset = getProviderPreset('openai')!
    preset.settings[0].controller_props.value = 'sk-test'
    expect(predefinedProviders.find((p) => p.provider === 'openai')?.settings[0].controller_props.value).toBe('')
  })

  it('covers every predefined provider', () => {
    for (const p of predefinedProviders) expect(getProviderPreset(p.provider)?.provider).toBe(p.provider)
  })
})
