import { useEffect, useState } from 'react'
import type { Theme } from './theme.ts'
import {
  DARK_QUERY,
  getSystemTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from './theme.ts'

type ThemeState = {
  theme: Theme
  // True once the user has chosen a theme (saved or, if storage fails, for this session only).
  explicit: boolean
}

type UseThemeResult = {
  theme: Theme
  toggleTheme: () => void
}

function getInitialState(): ThemeState {
  const stored = readStoredTheme()
  const applied = document.documentElement.dataset.theme
  return {
    theme: isTheme(applied) ? applied : resolveTheme(stored, getSystemTheme()),
    explicit: stored !== null,
  }
}

export function useTheme(): UseThemeResult {
  const [state, setState] = useState<ThemeState>(getInitialState)
  const { theme, explicit } = state

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (explicit) {
      writeStoredTheme(theme)
    }
  }, [theme, explicit])

  useEffect(() => {
    if (explicit || typeof window.matchMedia !== 'function') {
      return
    }
    let query: MediaQueryList
    try {
      query = window.matchMedia(DARK_QUERY)
    } catch {
      return
    }
    const handleChange = (event: MediaQueryListEvent) => {
      const system: Theme = event.matches ? 'dark' : 'light'
      setState((prev) => (prev.explicit ? prev : { ...prev, theme: system }))
    }
    query.addEventListener('change', handleChange)
    return () => {
      query.removeEventListener('change', handleChange)
    }
  }, [explicit])

  const toggleTheme = () => {
    setState((prev) => ({
      theme: prev.theme === 'dark' ? 'light' : 'dark',
      explicit: true,
    }))
  }

  return { theme, toggleTheme }
}
