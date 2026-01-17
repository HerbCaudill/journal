import { useEffect } from "react"

export interface KeyboardNavigationOptions {
  /** Callback when user presses left arrow (previous day) */
  onPrevious?: (() => void) | undefined
  /** Callback when user presses right arrow (next day) */
  onNext?: (() => void) | undefined
  /** Callback when user presses 't' key (go to today) */
  onToday?: (() => void) | undefined
  /** Whether keyboard navigation is enabled (default: true) */
  enabled?: boolean
}

/**
 * Custom hook for handling keyboard navigation between days.
 * Listens for left/right arrow key presses and triggers navigation callbacks.
 *
 * Note: Navigation is disabled when focus is in an input, textarea, or contenteditable
 * element to avoid interfering with text editing.
 *
 * @param options - Configuration options for keyboard navigation
 *
 * @example
 * ```tsx
 * useKeyboardNavigation({
 *   onPrevious: () => navigateToPrevDay(),
 *   onNext: () => navigateToNextDay(),
 *   onToday: () => navigateToToday(),
 * })
 * ```
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}): void {
  const { onPrevious, onNext, onToday, enabled = true } = options

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept keyboard events when focus is in an editable element
      const target = event.target as HTMLElement

      // Check for standard input elements
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return
      }

      // Check contentEditable including inherited state
      // contentEditable can be "true", "false", or "inherit"
      // We need to walk up the DOM tree to handle inherited values
      let el: HTMLElement | null = target
      while (el) {
        if (el.contentEditable === "true") {
          return // Found an editable ancestor, don't navigate
        }
        if (el.contentEditable === "false") {
          break // Found an explicit non-editable ancestor, stop checking
        }
        // contentEditable === "inherit" - continue checking parent
        el = el.parentElement
      }

      // Also check the isContentEditable property as a final safeguard
      // This handles edge cases where the DOM might not reflect the attribute correctly
      if (target.isContentEditable) {
        return
      }

      // Handle arrow keys, p/n keys, and 't' for today
      if ((event.key === "ArrowLeft" || event.key === "p" || event.key === "P") && onPrevious) {
        event.preventDefault()
        onPrevious()
      } else if ((event.key === "ArrowRight" || event.key === "n" || event.key === "N") && onNext) {
        event.preventDefault()
        onNext()
      } else if ((event.key === "t" || event.key === "T") && onToday) {
        event.preventDefault()
        onToday()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onPrevious, onNext, onToday, enabled])
}
