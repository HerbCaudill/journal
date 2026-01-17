import { useEffect } from "react"
import { useGoogleCalendar } from "../hooks/useGoogleCalendar"
import { CalendarIcon, ExternalLinkIcon, XIcon } from "./Icons"
import type { CalendarEvent } from "../lib/google-calendar"

interface CalendarEventsProps {
  /** The date to display events for in YYYY-MM-DD format */
  date: string
}

/**
 * Formats event time for display.
 * Returns just the time portion (e.g., "9:00 AM - 10:00 AM")
 * or "All day" for all-day events.
 */
function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) {
    return "All day"
  }

  const startDate = new Date(event.start)
  const endDate = new Date(event.end)

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })

  return `${formatTime(startDate)} - ${formatTime(endDate)}`
}

/**
 * Displays Google Calendar events for a specific date.
 * Handles authentication state and loading/error states.
 */
export function CalendarEvents({ date }: CalendarEventsProps) {
  const { authState, isLoading, error, events, fetchEvents, clearError } = useGoogleCalendar()

  // Fetch events when the date changes and user is authenticated
  useEffect(() => {
    if (authState === "authenticated") {
      fetchEvents(date)
    }
  }, [date, authState, fetchEvents])

  // Only render when user is authenticated with Google Calendar
  if (authState !== "authenticated") {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="text-foreground flex items-center gap-2 text-sm font-medium">
        <CalendarIcon />
        Calendar
      </h3>

      {error && <ErrorMessage message={error} onDismiss={clearError} />}

      <EventsList isLoading={isLoading} events={events} />
    </div>
  )
}

interface ErrorMessageProps {
  message: string
  onDismiss: () => void
}

function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex items-start justify-between gap-2 rounded p-2 text-sm"
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="text-destructive hover:text-destructive/80 shrink-0 transition-colors"
        aria-label="Dismiss error"
      >
        <XIcon />
      </button>
    </div>
  )
}

interface EventsListProps {
  isLoading: boolean
  events: CalendarEvent[]
}

function EventsList({ isLoading, events }: EventsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <EventSkeleton />
        <EventSkeleton />
      </div>
    )
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">No events scheduled for this day.</p>
  }

  return (
    <ul className="space-y-2" role="list" aria-label="Calendar events">
      {events.map(event => (
        <EventItem key={event.id} event={event} />
      ))}
    </ul>
  )
}

interface EventItemProps {
  event: CalendarEvent
}

function EventItem({ event }: EventItemProps) {
  const timeText = formatEventTime(event)
  const isCancelled = event.status === "cancelled"
  const isTentative = event.status === "tentative"

  return (
    <li className={`bg-muted rounded p-2 ${isCancelled ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`text-foreground truncate text-sm font-medium ${
              isCancelled ? "line-through" : ""
            }`}
          >
            {event.summary}
            {isTentative && <span className="text-muted-foreground ml-1 text-xs">(tentative)</span>}
          </p>
          <p className="text-muted-foreground text-xs">{timeText}</p>
          {event.location && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">📍 {event.location}</p>
          )}
        </div>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            aria-label={`Open ${event.summary} in Google Calendar`}
          >
            <ExternalLinkIcon />
          </a>
        )}
      </div>
    </li>
  )
}

function EventSkeleton() {
  return (
    <div className="bg-muted animate-pulse rounded p-2" aria-hidden="true">
      <div className="bg-muted-foreground/20 mb-1 h-4 w-3/4 rounded" />
      <div className="bg-muted-foreground/20 h-3 w-1/2 rounded" />
    </div>
  )
}
