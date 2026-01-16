import { EntryEditor } from "./EntryEditor"

interface DayViewProps {
  /** The date to display in YYYY-MM-DD format */
  date: string
}

/**
 * Main screen component showing the journal entry for a specific date.
 * Provides an editor for the entry.
 */
export function DayView({ date }: DayViewProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <EntryEditor date={date} />
    </div>
  )
}
