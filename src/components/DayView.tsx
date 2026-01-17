import { useCallback, useState } from "react"
import { useJournal } from "../context/JournalContext"
import { EntryEditor } from "./EntryEditor"
import { LLMSection, SubmitButtonIcon } from "./LLMSection"
import type { LLMSubmitButtonProps } from "./LLMSection"
import { CalendarEvents } from "./CalendarEvents"
import { InputGroupButton } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
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
  const [submitButtonProps, setSubmitButtonProps] = useState<LLMSubmitButtonProps | null>(null)
  const [isEditing, setIsEditing] = useState(false)

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

  // Get assistant messages for initial conversation state
  const assistantMessages = entry?.messages.filter(m => m.role === "assistant") ?? []

  // Hide EntryEditor once conversation has started (has assistant messages)
  const hasConversation = assistantMessages.length > 0

  // Show EntryEditor when: no conversation yet, OR in edit mode
  const showEditor = !hasConversation || isEditing

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

      {/* Edit button - show when conversation started but not in edit mode */}
      {hasConversation && !isEditing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="self-start"
          aria-label="Edit journal entry"
        >
          <svg
            className="mr-1 h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          Edit entry
        </Button>
      )}

      {/* EntryEditor - show when no conversation yet, or when in edit mode */}
      {showEditor && (
        <EntryEditor date={date} footer={hasConversation ? editModeFooter : submitButton} />
      )}

      <LLMSection
        entryContent={entryContent}
        apiKey={apiKey}
        provider={llmProvider}
        initialMessages={assistantMessages}
        onMessagesChange={handleMessagesChange}
        bio={bio}
        additionalInstructions={additionalInstructions}
        onSubmitButtonProps={hasConversation ? undefined : setSubmitButtonProps}
      />
    </div>
  )
}
