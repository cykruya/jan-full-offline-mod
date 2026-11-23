import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---- Module mocks ----------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  startEngineSetupMock: vi.fn().mockResolvedValue(undefined),
  verifyGpuOffloadMock: vi.fn(),
  verifyEmbeddingModelMock: vi.fn(),
  getHardwareInfoMock: vi.fn(),
  navigateMock: vi.fn(),
  eventHandlers: {} as Record<string, any>,
}))

vi.mock('@/hooks/useServiceHub', () => {
  const stub = () => ({
    models: () => ({
      startEngineSetup: hoisted.startEngineSetupMock,
      verifyGpuOffload: hoisted.verifyGpuOffloadMock,
      verifyEmbeddingModel: hoisted.verifyEmbeddingModelMock,
    }),
    hardware: () => ({ getHardwareInfo: hoisted.getHardwareInfoMock }),
  })
  return { useServiceHub: stub, getServiceHub: stub }
})

vi.mock('@/i18n/react-i18next-compat', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => opts?.defaultValue ?? k,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hoisted.navigateMock,
}))

vi.mock('@janhq/core', () => ({
  AppEvent: { onModelImported: 'onModelImported' },
  events: {
    on: vi.fn((name: string, handler: any) => {
      hoisted.eventHandlers[name] = handler
    }),
    off: vi.fn(),
  },
}))

vi.mock('@/constants/routes', () => ({
  route: { settings: { providers: '/settings/providers/$providerName' } },
}))

vi.mock('@/containers/HeaderPage', () => ({
  default: () => <header data-testid="header-page" />,
}))
vi.mock('../HeaderPage', () => ({
  default: () => <header data-testid="header-page" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}))

import SetupScreen from '../SetupScreen'

// The readiness probes resolve after mount, so flush them before asserting to
// keep pending state updates out of the test.
const renderSetup = async () => {
  const utils = render(<SetupScreen />)
  await act(async () => {})
  return utils
}

/** Passes the welcome gate, which is where the flow now begins. */
const start = async () => {
  await act(async () => {
    fireEvent.click(screen.getByText('setup:startSetup'))
  })
}

const renderStarted = async () => {
  const utils = await renderSetup()
  await start()
  return utils
}

/** Advances past the llama.cpp setup page, which never auto-advances. */
const continueSetup = async () => {
  await act(async () => {
    fireEvent.click(
      screen.getByText(/setup:(continueStep|continueAnyway|skipStep)/)
    )
  })
}

const renderPastSetup = async () => {
  const utils = await renderStarted()
  await continueSetup()
  return utils
}

const currentPage = () =>
  screen.getByTestId('setup-wizard').getAttribute('data-page')

describe('SetupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.eventHandlers = {}
    // Healthy by default, so the wizard settles on the model page; individual
    // tests opt into a warning to hold an earlier page.
    hoisted.getHardwareInfoMock.mockResolvedValue({
      cpu: { name: 'Ryzen 7 5800X' },
      gpus: [{ name: 'RTX 4070', driver_version: '550.54' }],
    })
    hoisted.verifyGpuOffloadMock.mockResolvedValue({
      status: 'ok',
      backend: 'linux-cuda-12-common_cpus-x64',
      gpuExpected: true,
      engineDeviceCount: 1,
    })
    hoisted.verifyEmbeddingModelMock.mockResolvedValue({
      status: 'ok',
      modelId: 'sentence-transformer-mini',
      dimension: 384,
    })
    localStorage.clear()
  })

  it('renders the header page component', async () => {
    await renderStarted()
    expect(screen.getByTestId('header-page')).toBeInTheDocument()
  })

  it('runs the engine and embedding probes on mount', async () => {
    await renderStarted()
    expect(hoisted.verifyGpuOffloadMock).toHaveBeenCalled()
    expect(hoisted.verifyEmbeddingModelMock).toHaveBeenCalled()
  })

  it('routes all visible copy through i18n', async () => {
    await renderStarted()
    expect(screen.queryByText('Hey, welcome to Jan!')).not.toBeInTheDocument()
    expect(screen.queryByText('Recommended model')).not.toBeInTheDocument()
    expect(screen.queryByText('Download')).not.toBeInTheDocument()
  })

  describe('welcome gate', () => {
    it('opens on the welcome page', async () => {
      await renderSetup()

      expect(currentPage()).toBe('welcome')
      expect(screen.getByText('setup:welcomeTitle')).toBeInTheDocument()
      expect(screen.getByText('setup:startSetup')).toBeInTheDocument()
    })

    // The first page is an invitation, not a progress report: nothing is probed
    // until the user asks for it.
    it('probes nothing until the user starts', async () => {
      await renderSetup()

      expect(hoisted.verifyGpuOffloadMock).not.toHaveBeenCalled()
      expect(hoisted.verifyEmbeddingModelMock).not.toHaveBeenCalled()
      expect(hoisted.getHardwareInfoMock).not.toHaveBeenCalled()
    })

    it('begins the checks on start', async () => {
      await renderSetup()
      await start()

      expect(hoisted.verifyGpuOffloadMock).toHaveBeenCalled()
      expect(hoisted.verifyEmbeddingModelMock).toHaveBeenCalled()
    })

    // The engine's own provisioning is hundreds of megabytes. It used to run at
    // app launch regardless, which made asking pointless.
    it('does not provision the engine until the user starts', async () => {
      await renderSetup()

      expect(hoisted.startEngineSetupMock).not.toHaveBeenCalled()
    })

    it('provisions the engine on start', async () => {
      await renderSetup()
      await start()

      expect(hoisted.startEngineSetupMock).toHaveBeenCalledTimes(1)
    })

    it('does not offer the model import yet', async () => {
      await renderSetup()

      expect(screen.queryByTestId('setup-import-model')).not.toBeInTheDocument()
    })
  })

  describe('GPU badge', () => {
    const holdSetupPage = () =>
      hoisted.verifyEmbeddingModelMock.mockResolvedValue({
        status: 'ok',
        pending: true,
      })

    it('names the GPU when offload is confirmed', async () => {
      holdSetupPage()

      await renderStarted()

      expect(currentPage()).toBe('setup')
      expect(screen.getByTestId('setup-gpu-badge').textContent).toContain(
        'setup:badgeGpu'
      )
    })

    // A GPU build that found no device runs on the CPU regardless of its name,
    // so the device count decides rather than the backend label.
    it('says CPU when a GPU build sees no device', async () => {
      holdSetupPage()
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'warning',
        backend: 'linux-cuda-12-common_cpus-x64',
        gpuExpected: true,
        engineDeviceCount: 0,
        reason: 'runtimeUnreachable',
      })

      await renderStarted()

      expect(screen.getByTestId('setup-gpu-badge').textContent).toContain(
        'setup:badgeCpu'
      )
    })

    it('says CPU for a CPU-only build', async () => {
      holdSetupPage()
      hoisted.getHardwareInfoMock.mockResolvedValue({
        cpu: { name: 'Ryzen 7 5800X' },
        gpus: [],
      })
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'ok',
        backend: 'linux-common_cpus-x64',
        gpuExpected: false,
        engineDeviceCount: 0,
      })

      await renderStarted()

      expect(screen.getByTestId('setup-gpu-badge').textContent).toContain(
        'setup:badgeCpu'
      )
    })

    // Neither answer is known until the engine has a backend.
    it('stays undecided while the engine is still setting up', async () => {
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'ok',
        backend: '',
        gpuExpected: false,
        engineDeviceCount: 0,
        pending: true,
      })

      await renderStarted()

      expect(screen.getByTestId('setup-gpu-badge').textContent).toContain(
        'setup:badgeGpuUnknown'
      )
    })
  })

  describe('one page at a time', () => {
    it('shows only the current page', async () => {
      await renderPastSetup()

      expect(currentPage()).toBe('model')
      // Settled check pages are gone rather than stacked above this one.
      expect(screen.queryByText('setup:stageSetup')).not.toBeInTheDocument()
      expect(screen.queryByTestId('setup-gpu-badge')).not.toBeInTheDocument()
    })

    it('holds the setup page while the engine is still setting up', async () => {
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'ok',
        backend: '',
        gpuExpected: false,
        engineDeviceCount: 0,
        pending: true,
      })

      await renderStarted()

      expect(currentPage()).toBe('setup')
      expect(screen.getByText('setup:checkEnginePreparing')).toBeInTheDocument()
    })

    it('holds the setup page while the embedding check is pending', async () => {
      hoisted.verifyEmbeddingModelMock.mockResolvedValue({
        status: 'ok',
        pending: true,
      })

      await renderStarted()

      expect(currentPage()).toBe('setup')
    })

    it('reports position within the flow', async () => {
      await renderStarted()
      expect(screen.getByTestId('setup-step-counter')).toBeInTheDocument()
    })

    // Auto-advancing skipped this page whenever the engine was already
    // installed, hiding the GPU badge.
    it('does not advance past the setup page on its own', async () => {
      await renderStarted()

      expect(currentPage()).toBe('setup')
      expect(screen.getByTestId('setup-gpu-badge')).toBeInTheDocument()
    })

    it('offers Continue once the setup work is done', async () => {
      await renderStarted()

      expect(screen.getByText('setup:continueStep')).toBeInTheDocument()
    })

    it('offers a skip while the setup work is still running', async () => {
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'ok',
        backend: '',
        gpuExpected: false,
        engineDeviceCount: 0,
        pending: true,
      })

      await renderStarted()

      expect(screen.getByText('setup:skipStep')).toBeInTheDocument()
    })

    // An engine page can sit for the length of a backend download, so waiting
    // must never be the only option.
    it('lets the user skip a page that is still running', async () => {
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'ok',
        backend: '',
        gpuExpected: false,
        engineDeviceCount: 0,
        pending: true,
      })

      await renderStarted()
      expect(currentPage()).toBe('setup')

      fireEvent.click(screen.getByText('setup:skipStep'))

      expect(currentPage()).toBe('model')
    })
  })

  describe('warnings', () => {
    const armEngineWarning = () =>
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'warning',
        backend: 'linux-cuda-12-common_cpus-x64',
        gpuExpected: true,
        engineDeviceCount: 0,
        reason: 'runtimeUnreachable',
        error: 'device probe exploded',
      })

    it('holds the page that warned', async () => {
      armEngineWarning()

      await renderStarted()

      expect(currentPage()).toBe('setup')
      expect(
        screen.getByText('setup:checkEngineRuntimeUnreachable')
      ).toBeInTheDocument()
      expect(screen.getByTestId('setup-page-warning')).toBeInTheDocument()
    })

    it('advances past it on Continue', async () => {
      armEngineWarning()

      await renderStarted()
      fireEvent.click(screen.getByText('setup:continueAnyway'))

      expect(currentPage()).toBe('model')
    })

    it('offers a re-run of the checks', async () => {
      armEngineWarning()

      await renderStarted()
      await act(async () => {
        fireEvent.click(screen.getByText('setup:retryChecks'))
      })

      expect(hoisted.verifyGpuOffloadMock).toHaveBeenCalledTimes(2)
    })

    it('exposes the raw failure detail behind a disclosure', async () => {
      armEngineWarning()

      await renderStarted()
      expect(screen.queryByText(/device probe exploded/)).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('setup:showDetails'))

      expect(screen.getByText(/device probe exploded/)).toBeInTheDocument()
    })

    it('shows dependency install advice inline instead of as a dialog', async () => {
      hoisted.verifyGpuOffloadMock.mockResolvedValue({
        status: 'warning',
        backend: 'linux-cuda-12-common_cpus-x64',
        gpuExpected: true,
        engineDeviceCount: 0,
        reason: 'missingLibrary',
        missingLibraries: ['libnccl.so.2'],
      })

      await renderStarted()

      expect(screen.getByTestId('dependency-advice')).toBeInTheDocument()
    })

    it('shows no advice when no libraries are named', async () => {
      armEngineWarning()

      await renderStarted()

      expect(screen.queryByTestId('dependency-advice')).not.toBeInTheDocument()
    })
  })

  describe('model page', () => {
    it('offers the import as its only action', async () => {
      await renderPastSetup()

      expect(screen.getByText('setup:importDescription')).toBeInTheDocument()
      expect(screen.getByTestId('setup-import-model')).toHaveTextContent('setup:importModel')
      expect(screen.getByTestId('setup-wizard').querySelectorAll('button')).toHaveLength(1)
    })

    // The page it opens blinks its Import button for `step: 'import_model'`.
    it('opens the llama.cpp models page with the import step', async () => {
      await renderPastSetup()
      fireEvent.click(screen.getByTestId('setup-import-model'))

      expect(hoisted.navigateMock).toHaveBeenCalledWith({
        to: '/settings/providers/$providerName',
        params: { providerName: 'llamacpp' },
        search: { step: 'import_model' },
      })
    })

    // Importing a model makes the provider usable, and the index route then
    // stops rendering this screen; nothing here decides setup is over.
    it('stays put until the index route replaces the screen', async () => {
      await renderPastSetup()
      await act(async () => {
        await hoisted.eventHandlers['onModelImported']?.({ modelId: 'any-model' })
      })

      expect(currentPage()).toBe('model')
      expect(hoisted.navigateMock).not.toHaveBeenCalled()
    })
  })

  describe('step numbering', () => {
    it('counts three pages', async () => {
      await renderSetup()

      expect(
        screen.getByTestId('setup-wizard').querySelectorAll('span.h-1').length
      ).toBe(3)
    })
  })
})
