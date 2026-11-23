import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  openExternalUrl: vi.fn(),
}))

vi.mock('@/hooks/useServiceHub', () => ({
  getServiceHub: () => ({ core: () => ({ invoke: h.invoke }) }),
}))
vi.mock('@/lib/externalLink', () => ({ openExternalUrl: h.openExternalUrl }))

import { openHelp } from '../help'

beforeEach(() => {
  h.invoke.mockReset().mockResolvedValue(undefined)
  h.openExternalUrl.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('openHelp', () => {
  it('opens the page in the bundled help file on Windows', () => {
    vi.stubGlobal('IS_WINDOWS', true)

    openHelp('desktop/remote-models/custom-endpoint.html#use-a-different-llamacpp-version')

    expect(h.invoke).toHaveBeenCalledWith('open_help', {
      topic: 'desktop/remote-models/custom-endpoint.html#use-a-different-llamacpp-version',
    })
    expect(h.openExternalUrl).not.toHaveBeenCalled()
  })

  it('opens the same page on the documentation site elsewhere', () => {
    vi.stubGlobal('IS_WINDOWS', false)

    openHelp('desktop/remote-models/custom-endpoint.html#use-a-different-llamacpp-version')
    openHelp('desktop/index.html')

    expect(h.openExternalUrl.mock.calls).toEqual([
      ['https://www.jan.ai/docs/desktop/remote-models/custom-endpoint#use-a-different-llamacpp-version'],
      ['https://www.jan.ai/docs/desktop/index'],
    ])
    expect(h.invoke).not.toHaveBeenCalled()
  })
})
