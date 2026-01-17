import { useCallback, useEffect, useRef, useState } from "react"
import { useJournal } from "../context/JournalContext"
import type { JournalEntry, Message } from "../types/journal"

const DEBOUNCE_DELAY = 500
const SAVED_INDICATOR_DURATION = 1500

type SaveStatus = "idle" | "saving" | "saved"

interface EntryEditorProps {
  /** The date for this entry in YYYY-MM-DD format */
  date: string
}

/**
 * Generates a unique ID for messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Textarea component with debounced auto-save to Automerge.
 * Manages a single user message for a given date's journal entry.
 */
export function EntryEditor({ date }: EntryEditorProps) {
  const { doc, changeDoc, isLoading } = useJournal()
  const [localContent, setLocalContent] = useState("")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Find or initialize the entry for this date
  const entry = doc?.entries[date]
  const userMessage = entry?.messages.find(m => m.role === "user")

  // Sync local content with document on mount and when entry changes
  useEffect(() => {
    if (userMessage) {
      setLocalContent(userMessage.content)
    } else {
      setLocalContent("")
    }
  }, [userMessage?.content, date])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current)
      }
    }
  }, [])

  // Save content to Automerge document
  const saveToDocument = useCallback(
    (content: string) => {
      if (!doc) return

      changeDoc(d => {
        const now = Date.now()

        if (!d.entries[date]) {
          // Create new entry
          const newEntry: JournalEntry = {
            id: generateId(),
            date,
            messages: [],
            createdAt: now,
            updatedAt: now,
          }
          d.entries[date] = newEntry
        }

        const existingEntry = d.entries[date]
        existingEntry.updatedAt = now

        // Find existing user message or create new one
        const existingUserMessageIndex = existingEntry.messages.findIndex(m => m.role === "user")

        if (existingUserMessageIndex >= 0) {
          // Update existing message
          existingEntry.messages[existingUserMessageIndex].content = content
        } else {
          // Add new user message
          const newMessage: Message = {
            id: generateId(),
            role: "user",
            content,
            createdAt: now,
          }
          existingEntry.messages.push(newMessage)
        }
      })

      // Show "Saved" indicator
      setSaveStatus("saved")

      // Clear any existing saved indicator timeout
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current)
      }

      // Hide the indicator after a delay
      savedIndicatorTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle")
      }, SAVED_INDICATOR_DURATION)
    },
    [doc, changeDoc, date],
  )

  // Handle content change with debouncing
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      setLocalContent(newContent)

      // Show saving indicator
      setSaveStatus("saving")

      // Clear existing saved indicator timeout
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current)
      }

      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Set new debounced save
      debounceTimeoutRef.current = setTimeout(() => {
        saveToDocument(newContent)
      }, DEBOUNCE_DELAY)
    },
    [saveToDocument],
  )

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [localContent])

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="bg-muted h-32 rounded-md" />
      </div>
    )
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        className="bg-card focus:ring-ring min-h-[200px] w-full resize-none rounded-md border p-4 text-base leading-relaxed focus:ring-2 focus:ring-offset-2 focus:outline-none"
        aria-label="Journal entry"
      />
      {saveStatus !== "idle" && (
        <div
          className="text-muted-foreground absolute right-3 bottom-3 text-xs"
          aria-live="polite"
          data-testid="save-indicator"
        >
          {saveStatus === "saving" ? "Saving..." : "Saved"}
        </div>
      )}
    </div>
  )
}
