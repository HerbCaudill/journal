import { useState, useCallback, useRef, useEffect } from "react"
import { useLLM } from "../hooks/useLLM"
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
  bio?: string
  /** Additional instructions for customizing AI behavior */
  additionalInstructions?: string
  /** Callback to receive submit button props - parent can render the button elsewhere */
  onSubmitButtonProps?: (props: LLMSubmitButtonProps) => void
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

/**
 * Renders the submit button icon based on loading state
 */
export function SubmitButtonIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )
  }
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

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
}: LLMSectionProps) {
  const { messages, isLoading, error, send } = useLLM({
    provider,
    apiKey,
    initialMessages,
    bio,
    additionalInstructions,
  })

  const [localError, setLocalError] = useState<string | null>(null)
  const [followUpInput, setFollowUpInput] = useState("")
  const followUpInputRef = useRef<HTMLTextAreaElement>(null)

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

    const response = await send(entryContent)

    if (response.success && onMessagesChange) {
      // Include both the user message and assistant response
      onMessagesChange([
        ...messages,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: entryContent.trim(),
          createdAt: Date.now(),
        },
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          createdAt: Date.now(),
        },
      ])
    }
  }, [apiKey, entryContent, send, messages, onMessagesChange])

  // Handle sending a follow-up message
  const handleFollowUp = useCallback(async () => {
    if (!followUpInput.trim()) {
      return
    }

    const messageContent = followUpInput.trim()
    setFollowUpInput("") // Clear input immediately

    const response = await send(messageContent)

    if (response.success && onMessagesChange) {
      // Update with the new user message and assistant response
      onMessagesChange([
        ...messages,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: messageContent,
          createdAt: Date.now(),
        },
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          createdAt: Date.now(),
        },
      ])
    } else if (!response.success) {
      // Restore the input if there was an error
      setFollowUpInput(messageContent)
    }
  }, [followUpInput, send, messages, onMessagesChange])

  // Auto-focus the follow-up input when a response is received
  useEffect(() => {
    // Focus when loading finishes and there are messages (conversation has started)
    if (!isLoading && messages.length > 0 && apiKey) {
      followUpInputRef.current?.focus()
    }
  }, [isLoading, messages.length, apiKey])

  // Provide submit button props to parent via callback
  useEffect(() => {
    onSubmitButtonProps?.({
      onClick: handleSubmit,
      disabled: isLoading || !apiKey,
      isLoading,
      ariaLabel: `Ask ${providerName}`,
    })
  }, [onSubmitButtonProps, handleSubmit, isLoading, apiKey, providerName])

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

      {/* Conversation display - show all messages */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map(message => (
            <div
              key={message.id}
              className={
                message.role === "assistant" ?
                  "bg-muted rounded-md p-4"
                : "bg-primary/10 rounded-md p-4"
              }
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
              if (e.key === "Enter" && !e.shiftKey && !isLoading && followUpInput.trim()) {
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
              {isLoading ?
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              : <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              }
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
