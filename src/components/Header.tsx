import { useState, useRef, useEffect, useCallback } from "react"
import { parseDate } from "../lib/dates"
import { DatePicker } from "./DatePicker"

interface HeaderProps {
  /** The current date in YYYY-MM-DD format */
  date: string
}

/**
 * Gets the day of week for display in the header
 * e.g., "Thursday"
 */
function getDayOfWeek(dateString: string): string {
  const date = parseDate(dateString)
  return date.toLocaleDateString("en-US", {
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
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })
  } else {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }
}

/**
 * Header component displaying the current date and a settings link.
 * Clicking on the date opens a date picker for navigation.
 */
export function Header({ date }: HeaderProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleDateSelect = useCallback((newDate: string) => {
    window.location.hash = `#/day/${newDate}`
    setIsDatePickerOpen(false)
  }, [])

  const handleClose = useCallback(() => {
    setIsDatePickerOpen(false)
  }, [])

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
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
    <header className="border-border flex items-center justify-between border-b p-4">
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          className="text-foreground hover:text-primary flex items-start gap-2 transition-colors"
          aria-expanded={isDatePickerOpen}
          aria-haspopup="dialog"
        >
          <h1 className="flex flex-col text-left">
            <span className="text-2xl leading-tight font-bold">{getDayOfWeek(date)}</span>
            <span className="text-muted-foreground text-sm font-normal">{getMonthDay(date)}</span>
          </h1>
          <ChevronDownIcon
            className={`mt-1.5 transition-transform ${isDatePickerOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isDatePickerOpen && (
          <div ref={datePickerRef} className="absolute top-full left-0 z-50 mt-2">
            <DatePicker selectedDate={date} onDateSelect={handleDateSelect} onClose={handleClose} />
          </div>
        )}
      </div>
      <a
        href="#/settings"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Settings"
      >
        <SettingsIcon />
      </a>
    </header>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
