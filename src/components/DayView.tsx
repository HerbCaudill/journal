import { useCallback, useEffect, useState } from "react"
import { useJournal } from "../context/JournalContext"
import { EntryEditor } from "./EntryEditor"
import { LLMSection, SubmitButtonIcon } from "./LLMSection"
import type { LLMSubmitButtonProps } from "./LLMSection"
import { CalendarEvents } from "./CalendarEvents"
import { InputGroupButton } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import type { Message } from "../types/journal"
import type { ProviderType } from "../lib/llm/types"

// Type for Automerge arrays which have special CRDT methods
interface AutomergeArray<T> extends Array<T> {
  insertAt(index: number, value: T): void
  deleteAt(index: number): void
}

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
  const [submitButtonProps, setSubmitButtonProps] = useState<LLMSubmitButtonProps | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  // Track conversation start locally to immediately hide editor (bypass Automerge state timing)
  const [conversationStarted, setConversationStarted] = useState(false)

  // Reset local conversation state when navigating to a different date
  useEffect(() => {
    setConversationStarted(false)
    setIsEditing(false)
  }, [date])

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
  const bio = doc?.settings?.bio ?? ""
  const additionalInstructions = doc?.settings?.additionalInstructions ?? ""

  // Get conversation messages (excluding the initial user message which is managed by EntryEditor)
  // The first user message is the journal entry content, subsequent messages are the conversation
  const allMessages = entry?.messages ?? []
  const conversationMessages = allMessages.slice(1) // Skip the first user message (journal entry)
  const assistantMessages = conversationMessages.filter(m => m.role === "assistant")

  // Hide EntryEditor once conversation has started (has assistant messages)
  // Use both persisted state (assistantMessages) and local state (conversationStarted)
  // to ensure immediate UI update when conversation starts
  const hasConversation = assistantMessages.length > 0 || conversationStarted

  // Show EntryEditor when: no conversation yet, OR in edit mode
  const showEditor = !hasConversation || isEditing

  // Handle when Claude conversation changes
  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      // Check if there are assistant messages - if so, mark conversation as started
      const hasAssistant = messages.some(m => m.role === "assistant")
      if (hasAssistant) {
        setConversationStarted(true)
      }

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

        // Get the first user message index (journal entry managed by EntryEditor)
        const firstUserMessageIndex = existingEntry.messages.findIndex(m => m.role === "user")

        // Cast to AutomergeArray to access CRDT-specific methods
        const msgs = existingEntry.messages as AutomergeArray<Message>

        // Delete all messages after the first user message (keep the journal entry)
        while (msgs.length > (firstUserMessageIndex >= 0 ? 1 : 0)) {
          msgs.deleteAt(firstUserMessageIndex >= 0 ? 1 : 0)
        }

        // Add all conversation messages using Automerge's insertAt
        // Clone each message to ensure we're not inserting document references
        let insertIndex = firstUserMessageIndex >= 0 ? 1 : 0
        for (const msg of messages) {
          const clonedMsg: Message = {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          }
          msgs.insertAt(insertIndex, clonedMsg)
          insertIndex++
        }
      })
    },
    [doc, changeDoc, date],
  )

  // Render the submit button for the entry editor footer
  const submitButton = submitButtonProps && (
    <InputGroupButton
      onClick={submitButtonProps.onClick}
      disabled={submitButtonProps.disabled}
      variant="default"
      size="icon-xs"
      aria-label={submitButtonProps.ariaLabel}
    >
      <SubmitButtonIcon isLoading={submitButtonProps.isLoading} />
    </InputGroupButton>
  )

  // Edit button footer for when editing during conversation
  const editModeFooter = (
    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} aria-label="Done editing">
      Done
    </Button>
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <CalendarEvents date={date} />

      {/* Original journal entry display - show when conversation started but not in edit mode */}
      {hasConversation && !isEditing && (
        <div className="group/entry">
          <p className="text-foreground whitespace-pre-wrap">{entryContent}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="text-muted-foreground/40 hover:text-muted-foreground mt-1 p-1 transition-opacity md:opacity-0 md:group-hover/entry:opacity-100 md:focus:opacity-100"
            aria-label="Edit journal entry"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
        </div>
      )}

      {/* EntryEditor - show when no conversation yet, or when in edit mode */}
      {showEditor && (
        <EntryEditor date={date} footer={hasConversation ? editModeFooter : submitButton} />
      )}

      <LLMSection
        entryContent={entryContent}
        apiKey={apiKey}
        provider={llmProvider}
        initialMessages={conversationMessages}
        onMessagesChange={handleMessagesChange}
        bio={bio}
        additionalInstructions={additionalInstructions}
        onSubmitButtonProps={hasConversation ? undefined : setSubmitButtonProps}
        onConversationStart={() => setConversationStarted(true)}
        conversationKey={date}
      />
    </div>
  )
}
