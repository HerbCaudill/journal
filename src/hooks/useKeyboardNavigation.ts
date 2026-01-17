import { useEffect } from "react"

export interface KeyboardNavigationOptions {
  /** Callback when user presses left arrow (previous day) */
  onPrevious?: () => void
  /** Callback when user presses right arrow (next day) */
  onNext?: () => void
  /** Callback when user presses 't' key (go to today) */
  onToday?: () => void
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
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept keyboard events when focus is in an editable element
      const target = event.target as HTMLElement
      const isEditableElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.contentEditable === "true"

      if (isEditableElement) {
        return
      }

      // Handle arrow keys and 't' for today
      if (event.key === "ArrowLeft" && onPrevious) {
        event.preventDefault()
        onPrevious()
      } else if (event.key === "ArrowRight" && onNext) {
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
