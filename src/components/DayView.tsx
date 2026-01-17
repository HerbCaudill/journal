import { useCallback, useEffect, useRef } from "react"
import { useJournal } from "../context/JournalContext"
import { useGeolocation } from "../hooks/useGeolocation"
import { EntryEditor } from "./EntryEditor"
import { LLMSection } from "./LLMSection"
import { CalendarEvents } from "./CalendarEvents"
import { LocationBadge } from "./LocationBadge"
import { getToday } from "../lib/dates"
import type { Message } from "../types/journal"
import type { ProviderType } from "../lib/llm/types"

// Environment variable defaults for API keys
const ENV_CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY ?? ""
const ENV_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ""

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
  const {
    isLoading: isCapturingLocation,
    error: locationError,
    permission,
    requestPosition,
  } = useGeolocation()

  const entry = doc?.entries[date]
  const userMessage = entry?.messages.find(m => m.role === "user")
  const entryContent = userMessage?.content ?? ""

  // Get LLM provider and corresponding API key
  // Priority: saved value > env var default
  const llmProvider = (doc?.settings?.llmProvider ?? "claude") as ProviderType
  const apiKey =
    llmProvider === "claude" ?
      doc?.settings?.claudeApiKey || ENV_CLAUDE_API_KEY
    : doc?.settings?.openaiApiKey || ENV_OPENAI_API_KEY

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

  // Handle capturing location and saving it to the entry
  const handleCaptureLocation = useCallback(async () => {
    const pos = await requestPosition()
    if (!pos) return

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
      existingEntry.position = pos
    })
  }, [requestPosition, changeDoc, date])

  // Determine if location capture should be available
  const isGeolocationSupported = permission !== "unavailable"
  const isPermissionDenied = permission === "denied"
  const hasPosition = !!entry?.position
  const isToday = date === getToday()

  // Track if we've already attempted auto-capture to avoid repeated calls
  const hasAttemptedAutoCapture = useRef(false)

  // Auto-capture location for today's entry when:
  // - It's today
  // - Geolocation is supported
  // - Permission is not denied
  // - Entry doesn't already have a position
  // - We haven't already attempted to capture
  useEffect(() => {
    if (
      isToday &&
      isGeolocationSupported &&
      !isPermissionDenied &&
      !hasPosition &&
      !hasAttemptedAutoCapture.current &&
      !isCapturingLocation
    ) {
      hasAttemptedAutoCapture.current = true
      handleCaptureLocation()
    }
  }, [
    isToday,
    isGeolocationSupported,
    isPermissionDenied,
    hasPosition,
    isCapturingLocation,
    handleCaptureLocation,
  ])

  // Reset auto-capture attempt when date changes
  useEffect(() => {
    hasAttemptedAutoCapture.current = false
  }, [date])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <CalendarEvents date={date} />
      {hasPosition && entry?.position && (
        <div className="flex items-center gap-2">
          <LocationBadge position={entry.position} onClick={handleCaptureLocation} />
          {isCapturingLocation && (
            <span className="text-muted-foreground text-sm">Updating...</span>
          )}
          {locationError && <span className="text-destructive text-sm">{locationError}</span>}
        </div>
      )}
      <EntryEditor date={date} />
      <LLMSection
        entryContent={entryContent}
        apiKey={apiKey}
        provider={llmProvider}
        initialMessages={assistantMessages}
        onMessagesChange={handleMessagesChange}
      />
    </div>
  )
}
