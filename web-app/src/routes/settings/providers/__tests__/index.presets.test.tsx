import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Route as ProvidersRoute } from '../index'

const mocks = vi.hoisted(() => ({ addProvider: vi.fn(), created: ['', '', '', 'openai'] as [string, string, string, ProviderApiType] }))

vi.mock('@/containers/SettingsMenu', () => ({ default: () => null }))
vi.mock('@/containers/HeaderPage', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/containers/dialogs', () => ({
  AddProviderDialog: ({ onCreateProvider }: { onCreateProvider: (...args: typeof mocks.created) => void }) => (
    <button data-testid="create" onClick={() => onCreateProvider(...mocks.created)} />
  ),
}))
vi.mock('@/hooks/useModelProvider', () => ({
  useModelProvider: () => ({ providers: [], addProvider: mocks.addProvider, updateProvider: vi.fn() }),
}))
vi.mock('@/hooks/useServiceHub', () => ({ useServiceHub: () => ({}) }))
vi.mock('@/i18n/react-i18next-compat', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: object) => config,
  useNavigate: () => vi.fn(),
}))

const create = (...args: typeof mocks.created) => {
  mocks.created = args
  const Component = ProvidersRoute.component as React.ComponentType
  render(<Component />)
  fireEvent.click(screen.getByTestId('create'))
  return mocks.addProvider.mock.calls[0][0] as ProviderObject
}

describe('creating a provider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds the predefined provider when the name is a preset', () => {
    const added = create('anthropic', 'https://api.anthropic.com/v1', 'sk-test', 'anthropic')
    expect(added).toMatchObject({ provider: 'anthropic', active: true, api_key: 'sk-test', base_url: 'https://api.anthropic.com/v1', api_type: 'anthropic' })
    expect(added.explore_models_url).toBeTruthy()
    expect(added.custom_header).toEqual(expect.arrayContaining([{ header: 'anthropic-version', value: '2023-06-01' }]))
    expect(added.models.length).toBeGreaterThan(0)
    expect(added.settings.find((s) => s.key === 'api-key')?.controller_props.value).toBe('sk-test')
  })

  it('adds a bare OpenAI-compatible provider for any other name', () => {
    const added = create('my-llm-server', 'http://localhost:8080/v1', 'none', 'openai')
    expect(added).toMatchObject({ provider: 'my-llm-server', active: true, models: [], api_key: 'none', base_url: 'http://localhost:8080/v1' })
    expect(added.explore_models_url).toBeUndefined()
    expect(added.settings.find((s) => s.key === 'base-url')?.controller_props.value).toBe('http://localhost:8080/v1')
  })
})
