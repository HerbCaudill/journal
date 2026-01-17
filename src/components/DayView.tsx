import { useCallback, useState } from "react"
import { useJournal } from "../context/JournalContext"
import { EntryEditor } from "./EntryEditor"
import { LLMSection, SubmitButtonIcon } from "./LLMSection"
import type { LLMSubmitButtonProps } from "./LLMSection"
import { CalendarEvents } from "./CalendarEvents"
import { InputGroupButton } from "@/components/ui/input-group"
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <CalendarEvents date={date} />
      {!hasConversation && <EntryEditor date={date} footer={submitButton} />}
      <LLMSection
        entryContent={entryContent}
        apiKey={apiKey}
        provider={llmProvider}
        initialMessages={assistantMessages}
        onMessagesChange={handleMessagesChange}
        bio={bio}
        additionalInstructions={additionalInstructions}
        onSubmitButtonProps={setSubmitButtonProps}
      />
    </div>
  )
}
