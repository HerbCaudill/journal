import { EntryEditor } from "./EntryEditor"
import { parseDate } from "../lib/dates"

interface DayViewProps {
  /** The date to display in YYYY-MM-DD format */
  date: string
}

/**
 * Formats a date for display in the header
 * e.g., "Thursday, January 16, 2025"
 */
function formatDisplayDate(dateString: string): string {
  const date = parseDate(dateString)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Main screen component showing the journal entry for a specific date.
 * Displays the formatted date and provides an editor for the entry.
 */
export function DayView({ date }: DayViewProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h2 className="text-foreground text-2xl font-semibold">{formatDisplayDate(date)}</h2>
      <EntryEditor date={date} />
    </div>
  )
}
