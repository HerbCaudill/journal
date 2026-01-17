import { useState, useMemo } from "react"
import { parseDate, formatDate, getToday } from "../lib/dates"
import { useJournal } from "../context/JournalContext"

interface DatePickerProps {
  /** The currently selected date in YYYY-MM-DD format */
  selectedDate: string
  /** Callback when a date is selected */
  onDateSelect: (date: string) => void
  /** Callback to close the picker */
  onClose?: () => void
}

/**
 * Gets the first day of the month for a given date
 */
function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

/**
 * Gets the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Gets the day of the week (0 = Sunday) for the first day of the month
 */
function getFirstDayOfWeek(year: number, month: number): number {
  return getFirstDayOfMonth(year, month).getDay()
}

/**
 * Generates calendar days for a month view, including padding days from previous/next months
 */
function generateCalendarDays(
  year: number,
  month: number,
): { date: string; isCurrentMonth: boolean }[] {
  const days: { date: string; isCurrentMonth: boolean }[] = []
  const firstDayOfWeek = getFirstDayOfWeek(year, month)
  const daysInMonth = getDaysInMonth(year, month)
  const daysInPrevMonth = getDaysInMonth(year, month - 1)

  // Previous month's days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const day = daysInPrevMonth - i
    days.push({
      date: formatDate(new Date(prevYear, prevMonth, day)),
      isCurrentMonth: false,
    })
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: formatDate(new Date(year, month, day)),
      isCurrentMonth: true,
    })
  }

  // Next month's days to fill the grid (6 rows * 7 days = 42)
  const remainingDays = 42 - days.length
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    days.push({
      date: formatDate(new Date(nextYear, nextMonth, day)),
      isCurrentMonth: false,
    })
  }

  return days
}

/**
 * DatePicker component displaying a calendar with navigation.
 * Days with journal entries are marked with a dot indicator.
 */
export function DatePicker({ selectedDate, onDateSelect, onClose }: DatePickerProps) {
  const { doc } = useJournal()
  const selectedParsed = parseDate(selectedDate)
  const [viewYear, setViewYear] = useState(selectedParsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedParsed.getMonth())

  const today = getToday()

  // Get set of dates that have entries with content
  const datesWithEntries = useMemo(() => {
    if (!doc?.entries) return new Set<string>()
    const dates = new Set<string>()
    for (const entry of Object.values(doc.entries)) {
      // Only mark days that have at least one message
      if (entry.messages && entry.messages.length > 0) {
        dates.add(entry.date)
      }
    }
    return dates
  }, [doc?.entries])

  const calendarDays = useMemo(
    () => generateCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const handlePreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleDateClick = (date: string) => {
    onDateSelect(date)
    onClose?.()
  }

  const handleTodayClick = () => {
    const todayParsed = parseDate(today)
    setViewYear(todayParsed.getFullYear())
    setViewMonth(todayParsed.getMonth())
    onDateSelect(today)
    onClose?.()
  }

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  return (
    <div className="bg-popover border-border w-72 rounded-lg border p-4 shadow-lg">
      {/* Month navigation header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={handlePreviousMonth}
          className="hover:bg-accent rounded p-1 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeftIcon />
        </button>
        <span className="text-foreground text-sm font-medium">{monthName}</span>
        <button
          onClick={handleNextMonth}
          className="hover:bg-accent rounded p-1 transition-colors"
          aria-label="Next month"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-muted-foreground py-1 text-center text-xs font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ date, isCurrentMonth }) => {
          const isSelected = date === selectedDate
          const isToday = date === today
          const hasEntry = datesWithEntries.has(date)

          return (
            <button
              key={date}
              onClick={() => handleDateClick(date)}
              className={`relative rounded p-2 text-sm transition-colors ${!isCurrentMonth ? "text-muted-foreground/50" : "text-foreground"} ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent"} ${isToday && !isSelected ? "ring-primary ring-1" : ""} `}
              aria-label={date}
              aria-current={isToday ? "date" : undefined}
            >
              {parseDate(date).getDate()}
              {hasEntry && (
                <span
                  className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                    isSelected ? "bg-primary-foreground" : "bg-primary"
                  }`}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Today button */}
      <div className="border-border mt-4 border-t pt-4">
        <button
          onClick={handleTodayClick}
          className="text-primary hover:text-primary/80 w-full text-sm transition-colors"
        >
          Go to Today
        </button>
      </div>
    </div>
  )
}

function ChevronLeftIcon() {
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
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
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
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
