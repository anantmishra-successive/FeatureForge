export type Theme = 'light' | 'dark'

// The inline pre-paint script in index.html reads this same key; keep them in sync.
export const THEME_STORAGE_KEY = 'featureforge-theme'

export const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (private mode, blocked, quota): keep the choice in memory only.
  }
}

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function resolveTheme(stored: Theme | null, system: Theme): Theme {
  return stored ?? system
}
