import { useState, useRef, useEffect, useCallback } from "react"
import { parseDate, addDays, getToday, isFutureDate } from "../lib/dates"
import { DatePicker } from "./DatePicker"
import { LocationBadge } from "./LocationBadge"
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "./Icons"
import type { GeoPosition } from "../hooks/useGeolocation"

interface HeaderProps {
  /** The current date in YYYY-MM-DD format */
  date: string
  /** Whether to show navigation controls (only shown on day view, not settings) */
  showNavigation?: boolean
  /** Optional position to display in the header */
  position?: GeoPosition | null
  /** Optional click handler for location badge */
  onLocationClick?: () => void
}

/**
 * Gets the day of week for display in the header
 * e.g., "Thursday"
 */
function getDayOfWeek(dateString: string): string {
  const date = parseDate(dateString)
  return date.toLocaleDateString(undefined, {
    weekday: "long",
  })
}

/**
 * Gets the month and day for display in the header
 * e.g., "January 16" or "January 16, 2024" if not current year
 */
function getMonthDay(dateString: string): string {
  const date = parseDate(dateString)
  const currentYear = new Date().getFullYear()
  const dateYear = date.getFullYear()

  if (dateYear === currentYear) {
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })
  } else {
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }
}

/**
 * Header component displaying the current date with navigation.
 * Clicking on the date opens a date picker for navigation.
 * Layout: left arrow on left, day/date/calendar centered, right arrow on right.
 */
export function Header({ date, showNavigation = true, position, onLocationClick }: HeaderProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const calendarButtonRef = useRef<HTMLButtonElement>(null)

  const handleDateSelect = useCallback((newDate: string) => {
    window.location.hash = `#/day/${newDate}`
    setIsDatePickerOpen(false)
  }, [])

  const handlePreviousDay = useCallback(() => {
    const prevDay = addDays(date, -1)
    window.location.hash = `#/day/${prevDay}`
  }, [date])

  const handleNextDay = useCallback(() => {
    const nextDay = addDays(date, 1)
    // Prevent navigation to future dates
    if (isFutureDate(nextDay)) return
    window.location.hash = `#/day/${nextDay}`
  }, [date])

  // Check if we're viewing today (to disable next day button)
  const isToday = date === getToday()

  const handleClose = useCallback(() => {
    setIsDatePickerOpen(false)
  }, [])

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node) &&
        calendarButtonRef.current &&
        !calendarButtonRef.current.contains(event.target as Node)
      ) {
        setIsDatePickerOpen(false)
      }
    }

    if (isDatePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isDatePickerOpen])

  // Close date picker on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDatePickerOpen(false)
      }
    }

    if (isDatePickerOpen) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isDatePickerOpen])

  return (
    <header className="border-border border-b p-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        {/* Left: Previous day navigation */}
        <div className="flex flex-1 justify-start">
          {showNavigation && (
            <button
              onClick={handlePreviousDay}
              className="text-muted-foreground hover:text-foreground rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Previous day"
            >
              <ChevronLeftIcon />
            </button>
          )}
        </div>

        {/* Center: Day/date and calendar */}
        <div className="relative flex flex-col items-center">
          <h1 className="flex flex-col items-center text-center">
            <span className="text-2xl leading-tight font-bold">{getDayOfWeek(date)}</span>
            <div className="flex items-center gap-2">
              {showNavigation ?
                <button
                  ref={calendarButtonRef}
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={isDatePickerOpen}
                  aria-haspopup="dialog"
                >
                  <CalendarIcon size={12} aria-label="Open calendar" />
                  <span className="text-sm font-normal">{getMonthDay(date)}</span>
                </button>
              : <span className="text-muted-foreground text-sm font-normal">
                  {getMonthDay(date)}
                </span>
              }
              {position && <LocationBadge position={position} onClick={onLocationClick} />}
            </div>
          </h1>
          {showNavigation && isDatePickerOpen && (
            <div ref={datePickerRef} className="absolute top-full z-50 mt-2">
              <DatePicker
                selectedDate={date}
                onDateSelect={handleDateSelect}
                onClose={handleClose}
              />
            </div>
          )}
        </div>

        {/* Right: Next day navigation */}
        <div className="flex flex-1 justify-end">
          {showNavigation && (
            <button
              onClick={handleNextDay}
              disabled={isToday}
              className={`rounded-full p-2 transition-colors ${
                isToday ?
                  "cursor-not-allowed text-gray-300 dark:text-gray-700"
                : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              aria-label="Next day"
              aria-disabled={isToday}
            >
              <ChevronRightIcon />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
