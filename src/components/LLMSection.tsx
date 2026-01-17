import { useState, useCallback, useRef, useEffect } from "react"
import { useLLM } from "../hooks/useLLM"
import { SubmitButtonIcon } from "./Icons"
import type { Message } from "../types/journal"
import type { ProviderType } from "../lib/llm/types"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

/** Props for the LLM submit button */
export interface LLMSubmitButtonProps {
  onClick: () => void
  disabled: boolean
  isLoading: boolean
  ariaLabel: string
}

interface LLMSectionProps {
  /** The user's journal entry content to send to the LLM */
  entryContent: string
  /** API key for the LLM provider */
  apiKey: string
  /** LLM provider to use */
  provider: ProviderType
  /** Optional existing messages to initialize the conversation with */
  initialMessages?: Message[]
  /** Callback when messages change (for persisting to document) */
  onMessagesChange?: (messages: Message[]) => void
  /** User's bio - helps the AI understand context about the user */
  bio?: string | undefined
  /** Additional instructions for customizing AI behavior */
  additionalInstructions?: string | undefined
  /** Callback to receive submit button props - parent can render the button elsewhere */
  onSubmitButtonProps?: ((props: LLMSubmitButtonProps) => void) | undefined
  /** Callback when conversation starts (user submits first message) */
  onConversationStart?: () => void
  /** Unique key to identify the conversation context (e.g., date). When this changes, conversation resets. */
  conversationKey?: string | undefined
}

/**
 * Returns the display name for an LLM provider
 */
function getProviderDisplayName(provider: ProviderType): string {
  switch (provider) {
    case "claude":
      return "Claude"
    case "openai":
      return "AI"
    default:
      return "AI"
  }
}

// Re-export SubmitButtonIcon for backwards compatibility with existing imports
export { SubmitButtonIcon } from "./Icons"

/**
 * Component for interacting with an LLM provider.
 * Displays the conversation history with assistant responses and follow-up input.
 * The submit button can be rendered externally via onSubmitButtonProps callback.
 */
export function LLMSection({
  entryContent,
  apiKey,
  provider,
  initialMessages = [],
  onMessagesChange,
  bio,
  additionalInstructions,
  onSubmitButtonProps,
  onConversationStart,
  conversationKey,
}: LLMSectionProps) {
  const { messages, isLoading, error, send } = useLLM({
    provider,
    apiKey,
    initialMessages,
    bio,
    additionalInstructions,
    conversationKey,
  })

  const [localError, setLocalError] = useState<string | null>(null)
  const [followUpInput, setFollowUpInput] = useState("")
  const followUpInputRef = useRef<HTMLTextAreaElement>(null)

  // Use a ref to store the latest handleSubmit to avoid circular update dependencies
  const handleSubmitRef = useRef<() => void>(() => {})

  const providerName = getProviderDisplayName(provider)

  // Handle sending the journal entry to the LLM
  const handleSubmit = useCallback(async () => {
    setLocalError(null)

    if (!apiKey) {
      setLocalError("Please configure your API key in Settings")
      return
    }

    if (!entryContent.trim()) {
      setLocalError("Please write something in your journal first")
      return
    }

    // Notify parent that conversation has started (so it can hide the editor immediately)
    onConversationStart?.()

    const response = await send(entryContent)

    if (response.success && onMessagesChange && response.messages) {
      // Use the messages from useLLM to ensure consistency between display and persistence
      // This avoids issues with stale closures where 'messages' would be outdated
      onMessagesChange(response.messages)
    }
  }, [apiKey, entryContent, send, onMessagesChange, onConversationStart])

  // Keep the ref updated with the latest handleSubmit
  handleSubmitRef.current = handleSubmit

  // Handle sending a follow-up message
  const handleFollowUp = useCallback(async () => {
    if (!followUpInput.trim()) {
      return
    }

    const messageContent = followUpInput.trim()
    setFollowUpInput("") // Clear input immediately

    const response = await send(messageContent)

    if (response.success && onMessagesChange && response.messages) {
      // Use the messages from useLLM to ensure consistency between display and persistence
      // This avoids issues with stale closures where 'messages' would be outdated
      onMessagesChange(response.messages)
    } else if (!response.success) {
      // Restore the input if there was an error
      setFollowUpInput(messageContent)
    }
  }, [followUpInput, send, onMessagesChange])

  // Auto-focus the follow-up input when a response is received
  useEffect(() => {
    // Focus when loading finishes and there are messages (conversation has started)
    if (!isLoading && messages.length > 0 && apiKey) {
      followUpInputRef.current?.focus()
    }
  }, [isLoading, messages.length, apiKey])

  // Provide submit button props to parent via callback
  // Use the ref for onClick to avoid circular dependencies that cause infinite loops
  useEffect(() => {
    onSubmitButtonProps?.({
      onClick: () => handleSubmitRef.current(),
      disabled: isLoading || !apiKey,
      isLoading,
      ariaLabel: `Ask ${providerName}`,
    })
  }, [onSubmitButtonProps, isLoading, apiKey, providerName])

  const displayError = localError || error

  return (
    <div className="flex flex-col gap-4">
      {/* Submit button - only rendered here if parent doesn't handle it via onSubmitButtonProps
          and no conversation has started yet (messages.length === 0) */}
      {!onSubmitButtonProps && messages.length === 0 && (
        <InputGroupButton
          onClick={handleSubmit}
          disabled={isLoading || !apiKey}
          variant="default"
          size="icon-xs"
          aria-label={`Ask ${providerName}`}
        >
          <SubmitButtonIcon isLoading={isLoading} />
        </InputGroupButton>
      )}

      {/* Error display */}
      {displayError && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {displayError}
        </div>
      )}

      {/* Conversation display - skip the first user message (journal entry shown by DayView) */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.slice(1).map(message => (
            <div
              key={message.id}
              className={message.role === "assistant" ? "bg-muted ml-4 rounded-md p-4" : ""}
              data-testid={message.role === "assistant" ? "assistant-response" : "user-message"}
            >
              <p className="text-foreground whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up input - shown after initial conversation */}
      {messages.length > 0 && apiKey && (
        <InputGroup className="bg-card">
          <InputGroupTextarea
            ref={followUpInputRef}
            value={followUpInput}
            onChange={e => setFollowUpInput(e.target.value)}
            onKeyDown={e => {
              // Submit on Enter (without Shift) or Cmd/Ctrl+Enter
              const isSubmitShortcut =
                (e.key === "Enter" && !e.shiftKey) ||
                (e.key === "Enter" && (e.metaKey || e.ctrlKey))
              if (isSubmitShortcut && !isLoading && followUpInput.trim()) {
                e.preventDefault()
                handleFollowUp()
              }
            }}
            placeholder=""
            disabled={isLoading}
            rows={2}
            className="min-h-20 text-base leading-relaxed"
            aria-label="Follow-up message"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupButton
              onClick={handleFollowUp}
              disabled={isLoading || !followUpInput.trim()}
              variant="default"
              size="icon-xs"
              aria-label="Send follow-up"
            >
              <SubmitButtonIcon isLoading={isLoading} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      )}

      {/* No API key message */}
      {!apiKey && (
        <p className="text-muted-foreground text-sm">
          To use {providerName}, please add your API key in{" "}
          <a href="#/settings" className="hover:text-foreground underline">
            Settings
          </a>
          .
        </p>
      )}
    </div>
  )
}
