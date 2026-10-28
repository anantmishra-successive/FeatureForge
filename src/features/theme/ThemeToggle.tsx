import type { ComponentPropsWithoutRef } from 'react'
import { useTheme } from './useTheme.ts'
import './ThemeToggle.css'

type ThemeToggleProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'onClick' | 'aria-pressed' | 'type' | 'aria-label' | 'children'
>

export function ThemeToggle({ className, ...rest }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const classes = className ? `theme-toggle ${className}` : 'theme-toggle'

  return (
    <button
      {...rest}
      type="button"
      className={classes}
      aria-label="Dark mode"
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <svg
        className="theme-toggle__icon"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {isDark ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </>
        )}
      </svg>
    </button>
  )
}
