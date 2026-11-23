import { vi } from 'vitest'
import llamacpp_extension from '../index'

/**
 * The host's proxy-bypassing loopback fetch (`ctx.internal.loopbackFetch`).
 * Every request the engine sends to its own server goes through it.
 */
export const loopbackFetch = vi.fn()

export function newExtension(): llamacpp_extension {
  return new llamacpp_extension(loopbackFetch)
}
