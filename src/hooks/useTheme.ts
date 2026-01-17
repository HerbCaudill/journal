import { useEffect, useCallback } from "react"
import { useJournal } from "../context/JournalContext"

/**
 * Theme preference type matching the Settings interface
 */
export type ThemePreference = "light" | "dark" | "system"

/**
 * Resolved theme (what's actually applied)
 */
export type ResolvedTheme = "light" | "dark"

/**
 * Hook to manage theme state and apply the dark class to the document.
 * Handles three theme preferences:
 * - 'light': Always light theme
 * - 'dark': Always dark theme
 * - 'system': Follow OS/browser preference via prefers-color-scheme
 *
 * @returns Object with current theme preference, resolved theme, and setter
 */
export function useTheme() {
  const { doc, changeDoc } = useJournal()

  // Get current theme preference from settings, default to 'system'
  const preference: ThemePreference = doc?.settings?.theme ?? "system"

  /**
   * Resolve the actual theme based on preference and system settings
   */
  const resolveTheme = useCallback((pref: ThemePreference): ResolvedTheme => {
    if (pref === "system") {
      // Check system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return pref
  }, [])

  /**
   * Apply theme class to document element
   */
  const applyTheme = useCallback((theme: ResolvedTheme) => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [])

  /**
   * Set theme preference in document settings
   */
  const setTheme = useCallback(
    (newTheme: ThemePreference) => {
      if (!doc) return

      changeDoc(d => {
        d.settings.theme = newTheme
      })
    },
    [doc, changeDoc],
  )

  // Apply theme on mount and when preference changes
  useEffect(() => {
    const resolved = resolveTheme(preference)
    applyTheme(resolved)
    // Note: resolveTheme and applyTheme are stable (empty deps in useCallback),
    // so we intentionally omit them to avoid unnecessary lint warnings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference])

  // Listen for system preference changes when using 'system' theme
  useEffect(() => {
    if (preference !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
    // Note: applyTheme is stable (empty deps in useCallback),
    // so we intentionally omit it to avoid unnecessary effect re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference])

  const resolved = resolveTheme(preference)

  return {
    /** Current theme preference ('light' | 'dark' | 'system') */
    preference,
    /** Resolved theme that's actually applied ('light' | 'dark') */
    resolved,
    /** Set the theme preference */
    setTheme,
  }
}
