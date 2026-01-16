import { useCallback, useRef } from "react"

export interface SwipeNavigationOptions {
  /** Callback when user swipes left (next day) */
  onSwipeLeft?: () => void
  /** Callback when user swipes right (previous day) */
  onSwipeRight?: () => void
  /** Minimum horizontal distance in pixels to trigger a swipe (default: 50) */
  threshold?: number
  /** Maximum vertical movement allowed relative to horizontal (default: 0.5) */
  maxVerticalRatio?: number
}

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

/**
 * Custom hook for handling swipe gestures for navigation.
 * Returns touch event handlers to attach to a container element.
 *
 * @param options - Configuration options for swipe detection
 * @returns Touch event handlers to spread onto a container element
 *
 * @example
 * ```tsx
 * const handlers = useSwipeNavigation({
 *   onSwipeLeft: () => navigateToNextDay(),
 *   onSwipeRight: () => navigateToPrevDay(),
 * })
 *
 * return <div {...handlers}>Content</div>
 * ```
 */
export function useSwipeNavigation(options: SwipeNavigationOptions = {}): SwipeHandlers {
  const { onSwipeLeft, onSwipeRight, threshold = 50, maxVerticalRatio = 0.5 } = options

  // Track the starting position of the touch
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
  }, [])

  const onTouchMove = useCallback((_e: React.TouchEvent) => {
    // We could add visual feedback here in the future
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) {
        return
      }

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX.current
      const deltaY = touch.clientY - touchStartY.current

      // Reset tracking
      touchStartX.current = null
      touchStartY.current = null

      // Check if this is a horizontal swipe
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      // If vertical movement is too large relative to horizontal, it's not a swipe
      if (absY > absX * maxVerticalRatio) {
        return
      }

      // Check if swipe distance exceeds threshold
      if (absX < threshold) {
        return
      }

      // Trigger appropriate callback
      if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      } else if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      }
    },
    [onSwipeLeft, onSwipeRight, threshold, maxVerticalRatio]
  )

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
