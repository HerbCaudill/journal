import { useCallback } from "react"
import { useJournal } from "../context/JournalContext"
import { EntryEditor } from "./EntryEditor"
import { ClaudeSection } from "./ClaudeSection"
import { CalendarEvents } from "./CalendarEvents"
import type { Message } from "../types/journal"

interface DayViewProps {
  /** The date to display in YYYY-MM-DD format */
  date: string
}

/**
 * Main screen component showing the journal entry for a specific date.
 * Provides an editor for the entry and Claude AI integration.
 */
export function DayView({ date }: DayViewProps) {
  const { doc, changeDoc } = useJournal()

  const entry = doc?.entries[date]
  const userMessage = entry?.messages.find(m => m.role === "user")
  const entryContent = userMessage?.content ?? ""
  const apiKey = doc?.settings?.claudeApiKey ?? ""

  // Get assistant messages for initial conversation state
  const assistantMessages = entry?.messages.filter(m => m.role === "assistant") ?? []

  // Handle when Claude conversation changes
  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      if (!doc) return

      changeDoc(d => {
        const now = Date.now()

        // Ensure entry exists
        if (!d.entries[date]) {
          d.entries[date] = {
            id: `${date}-${now}`,
            date,
            messages: [],
            createdAt: now,
            updatedAt: now,
          }
        }

        const existingEntry = d.entries[date]
        existingEntry.updatedAt = now

        // Keep the existing user message and update assistant messages
        const existingUserMessage = existingEntry.messages.find(m => m.role === "user")
        const newMessages: Message[] = existingUserMessage ? [existingUserMessage] : []

        // Add all assistant messages from the new messages array
        const assistantMsgs = messages.filter(m => m.role === "assistant")
        newMessages.push(...assistantMsgs)

        existingEntry.messages = newMessages
      })
    },
    [doc, changeDoc, date],
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <CalendarEvents date={date} />
      <EntryEditor date={date} />
      <ClaudeSection
        entryContent={entryContent}
        apiKey={apiKey}
        initialMessages={assistantMessages}
        onMessagesChange={handleMessagesChange}
      />
    </div>
  )
}
