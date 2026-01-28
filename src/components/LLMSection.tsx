import { useState, useCallback, useRef, useEffect } from "react"
import { useLLM } from "../hooks/useLLM"
import { SubmitButtonIcon } from "./Icons"
import { Markdown } from "./Markdown"
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
  const { messages, isLoading, error, send, editAndResend } = useLLM({
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Start editing a message
  const handleStartEdit = useCallback((messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }, [])

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditingContent("")
  }, [])

  // Submit edited message (resend from that point)
  const handleSubmitEdit = useCallback(async () => {
    if (!editingMessageId || !editingContent.trim()) {
      return
    }

    const response = await editAndResend(editingMessageId, editingContent.trim())

    if (response.success && onMessagesChange && response.messages) {
      onMessagesChange(response.messages)
    }

    setEditingMessageId(null)
    setEditingContent("")
  }, [editingMessageId, editingContent, editAndResend, onMessagesChange])

  // Focus the edit textarea when starting to edit
  useEffect(() => {
    if (editingMessageId && editTextareaRef.current) {
      editTextareaRef.current.focus()
      // Move cursor to end
      const len = editTextareaRef.current.value.length
      editTextareaRef.current.setSelectionRange(len, len)
    }
  }, [editingMessageId])

  // Reset editing state when conversationKey changes (navigating to different day)
  useEffect(() => {
    setEditingMessageId(null)
    setEditingContent("")
  }, [conversationKey])

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
              className={message.role === "assistant" ? "bg-muted my-2 ml-4 rounded-md p-4" : ""}
              data-testid={message.role === "assistant" ? "assistant-response" : "user-message"}
            >
              {message.role === "assistant" ?
                <Markdown>{message.content}</Markdown>
              : editingMessageId === message.id ?
                /* Inline edit mode for user messages */
                <div className="flex flex-col gap-2">
                  <textarea
                    ref={editTextareaRef}
                    value={editingContent}
                    onChange={e => setEditingContent(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Escape") {
                        e.preventDefault()
                        handleCancelEdit()
                      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        handleSubmitEdit()
                      }
                    }}
                    disabled={isLoading}
                    className="text-foreground bg-background border-input focus:ring-ring min-h-20 w-full resize-none rounded-md border p-2 font-serif text-base leading-relaxed focus:ring-2 focus:outline-none"
                    aria-label="Edit message"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitEdit}
                      disabled={isLoading || !editingContent.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50 rounded-md px-3 py-1 text-sm"
                      aria-label="Save and resend"
                    >
                      {isLoading ? "Sending..." : "Send"}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isLoading}
                      className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm"
                      aria-label="Cancel edit"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              : /* Regular display mode for user messages */
                <div className="group/message">
                  <p className="text-foreground font-serif whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <button
                    onClick={() => handleStartEdit(message.id, message.content)}
                    className="text-muted-foreground/40 hover:text-muted-foreground mt-1 p-1 transition-opacity md:opacity-0 md:group-hover/message:opacity-100 md:focus:opacity-100"
                    aria-label="Edit message"
                    disabled={isLoading}
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
              }
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
