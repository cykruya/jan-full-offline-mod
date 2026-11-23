import cloneDeep from 'lodash/cloneDeep'
import { predefinedProviders } from '@/constants/providers'
import { providerModels } from '@/constants/models'
import { getModelCapabilities } from '@/lib/models'

/**
 * The predefined provider named `name`, with its built-in model list, as a
 * provider ready to be added. Undefined when `name` is not a preset.
 */
export function getProviderPreset(name: string): ModelProvider | undefined {
  const provider = predefinedProviders.find((p) => p.provider === name)
  if (!provider) return undefined
  const builtInModels = (providerModels as Record<string, { models: unknown }>)[name]?.models
  const models = Array.isArray(builtInModels)
    ? builtInModels.map((model: string) => ({ id: model, name: model, capabilities: getModelCapabilities(name, model) }))
    : []
  return cloneDeep({ ...provider, models }) as ModelProvider
}
