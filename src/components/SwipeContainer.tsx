import { type ReactNode, useCallback } from "react"
import { useSwipeNavigation } from "../hooks/useSwipeNavigation"
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation"
import { addDays } from "../lib/dates"

interface SwipeContainerProps {
  /** The current date in YYYY-MM-DD format */
  date: string
  /** The content to render inside the swipeable container */
  children: ReactNode
}

/**
 * Wrapper component that adds swipe navigation support.
 * Swipe left to go to the next day, swipe right to go to the previous day.
 *
 * @example
 * ```tsx
 * <SwipeContainer date="2025-01-16">
 *   <DayView date="2025-01-16" />
 * </SwipeContainer>
 * ```
 */
export function SwipeContainer({ date, children }: SwipeContainerProps) {
  const navigateToDay = useCallback((newDate: string) => {
    window.location.hash = `#/day/${newDate}`
  }, [])

  const handleSwipeLeft = useCallback(() => {
    // Swipe left = go to next day
    const nextDay = addDays(date, 1)
    navigateToDay(nextDay)
  }, [date, navigateToDay])

  const handleSwipeRight = useCallback(() => {
    // Swipe right = go to previous day
    const prevDay = addDays(date, -1)
    navigateToDay(prevDay)
  }, [date, navigateToDay])

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  })

  // Add keyboard navigation (← → arrow keys)
  useKeyboardNavigation({
    onPrevious: handleSwipeRight, // Left arrow = previous day (same as swipe right)
    onNext: handleSwipeLeft, // Right arrow = next day (same as swipe left)
  })

  return (
    <div className="touch-pan-y" {...swipeHandlers}>
      {children}
    </div>
  )
}
