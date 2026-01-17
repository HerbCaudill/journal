import { useState, useCallback, useRef } from "react"
import { useLLM } from "../hooks/useLLM"
import type { Message } from "../types/journal"
import type { ProviderType } from "../lib/llm/types"

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
}

/**
 * Formats a timestamp for display
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
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
 * Component for interacting with an LLM provider.
 * Displays a submit button to send the journal entry to the LLM,
 * and shows the conversation history with assistant responses.
 */
export function LLMSection({
  entryContent,
  apiKey,
  provider,
  initialMessages = [],
  onMessagesChange,
}: LLMSectionProps) {
  const { messages, isLoading, error, send, reset } = useLLM({
    provider,
    apiKey,
    initialMessages,
  })

  const [localError, setLocalError] = useState<string | null>(null)
  const [followUpInput, setFollowUpInput] = useState("")
  const followUpInputRef = useRef<HTMLInputElement>(null)

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

  // Handle resetting the conversation
  const handleReset = useCallback(() => {
    reset()
    setLocalError(null)
    if (onMessagesChange) {
      onMessagesChange([])
    }
  }, [reset, onMessagesChange])

  const displayError = localError || error

  return (
    <div className="flex flex-col gap-4">
      {/* Submit button in input-like container */}
      <div className="border-input bg-background relative flex min-h-[3rem] items-end rounded-lg border p-2">
        {isLoading && (
          <span className="text-muted-foreground absolute top-2 left-3 text-sm">Thinking...</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              aria-label="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !apiKey}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-6 w-6 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Ask ${providerName}`}
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
          </button>
        </div>
      </div>

      {/* Error display */}
      {displayError && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {displayError}
        </div>
      )}

      {/* Conversation display */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-sm font-medium">Conversation</h3>
          {messages.map(message => (
            <div
              key={message.id}
              className={`rounded-md p-4 ${
                message.role === "user" ? "bg-primary/10 ml-8 text-right" : "bg-muted mr-8"
              }`}
              data-testid={message.role === "user" ? "user-message" : "assistant-response"}
            >
              <p className="text-foreground whitespace-pre-wrap">{message.content}</p>
              <span className="text-muted-foreground mt-2 block text-xs">
                {formatTime(message.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up input - shown after initial conversation */}
      {messages.length > 0 && apiKey && (
        <div className="border-input bg-background focus-within:ring-ring relative flex min-h-[3rem] items-end rounded-lg border p-2 focus-within:ring-2">
          <input
            ref={followUpInputRef}
            type="text"
            value={followUpInput}
            onChange={e => setFollowUpInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !isLoading && followUpInput.trim()) {
                handleFollowUp()
              }
            }}
            placeholder="Ask a follow-up question..."
            disabled={isLoading}
            className="text-foreground placeholder:text-muted-foreground mr-2 min-w-0 flex-1 bg-transparent text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Follow-up message"
          />
          <button
            onClick={handleFollowUp}
            disabled={isLoading || !followUpInput.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          </button>
        </div>
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
