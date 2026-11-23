import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localStorageKey } from '@/constants/localStorage'
import { backendStorage } from '@/lib/backendStorage'

type GeneralSettingState = {
  currentLanguage: Language
  spellCheckChatInput: boolean
  closeToTray: boolean
  stripReasoningFromContext: boolean
  setSpellCheckChatInput: (value: boolean) => void
  setCloseToTray: (value: boolean) => void
  setStripReasoningFromContext: (value: boolean) => void
  setCurrentLanguage: (value: Language) => void
}

export const useGeneralSetting = create<GeneralSettingState>()(
  persist(
    (set) => ({
      currentLanguage: 'en',
      spellCheckChatInput: true,
      closeToTray: false,
      stripReasoningFromContext: false,
      setSpellCheckChatInput: (value) => set({ spellCheckChatInput: value }),
      setCloseToTray: (value) => set({ closeToTray: value }),
      setStripReasoningFromContext: (value) =>
        set({ stripReasoningFromContext: value }),
      setCurrentLanguage: (value) => set({ currentLanguage: value }),
    }),
    {
      name: localStorageKey.settingGeneral,
      storage: createJSONStorage(() => backendStorage),
      skipHydration: true,
      partialize: (state) => ({
        currentLanguage: state.currentLanguage,
        spellCheckChatInput: state.spellCheckChatInput,
        closeToTray: state.closeToTray,
        stripReasoningFromContext: state.stripReasoningFromContext,
      }),
    }
  )
)


