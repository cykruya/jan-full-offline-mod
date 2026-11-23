import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const t = (key: string) => key
vi.mock('@/i18n/react-i18next-compat', () => ({ useTranslation: () => ({ t }) }))

import { AddProviderDialog } from '../AddProviderDialog'

describe('AddProviderDialog', () => {
  it('labels the name field like the other fields', () => {
    render(
      <AddProviderDialog onCreateProvider={vi.fn()}>
        <button>open</button>
      </AddProviderDialog>
    )
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByLabelText('provider:nameLabel')).toBe(
      screen.getByTestId('provider-name-input')
    )
  })

  it('fills the form from a preset and creates it under the preset name', async () => {
    const user = userEvent.setup()
    const onCreateProvider = vi.fn()
    render(
      <AddProviderDialog onCreateProvider={onCreateProvider}>
        <button>open</button>
      </AddProviderDialog>
    )
    fireEvent.click(screen.getByText('open'))
    await user.click(screen.getByTestId('provider-preset-trigger'))
    await user.click(screen.getByTestId('provider-preset-anthropic'))
    expect(screen.getByTestId('provider-name-input')).toHaveValue('anthropic')
    expect(screen.getByTestId('provider-base-url-input')).toHaveValue('https://api.anthropic.com/v1')
    fireEvent.change(screen.getByTestId('provider-api-key-input'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByTestId('add-provider-submit'))
    expect(onCreateProvider).toHaveBeenCalledWith('anthropic', 'https://api.anthropic.com/v1', 'sk-test', 'anthropic')
  })

  it('clears the prefilled fields when switching back to a custom provider', async () => {
    const user = userEvent.setup()
    render(
      <AddProviderDialog onCreateProvider={vi.fn()}>
        <button>open</button>
      </AddProviderDialog>
    )
    fireEvent.click(screen.getByText('open'))
    await user.click(screen.getByTestId('provider-preset-trigger'))
    await user.click(screen.getByTestId('provider-preset-openai'))
    expect(screen.getByTestId('provider-name-input')).toHaveValue('openai')
    await user.click(screen.getByTestId('provider-preset-trigger'))
    await user.click(screen.getByRole('menuitem', { name: 'provider:presetCustom' }))
    expect(screen.getByTestId('provider-name-input')).toHaveValue('')
    expect(screen.getByTestId('provider-base-url-input')).toHaveValue('')
  })
})
