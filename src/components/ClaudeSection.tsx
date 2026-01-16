import { useState, useCallback, useRef } from "react"
import { useClaude } from "../hooks/useClaude"
import type { Message } from "../types/journal"

interface ClaudeSectionProps {
  /** The user's journal entry content to send to Claude */
  entryContent: string
  /** API key for Claude */
  apiKey: string
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
 * Component for interacting with Claude AI.
 * Displays a submit button to send the journal entry to Claude,
 * and shows the conversation history with Claude's responses.
 */
export function ClaudeSection({
  entryContent,
  apiKey,
  initialMessages = [],
  onMessagesChange,
}: ClaudeSectionProps) {
  const { messages, isLoading, error, send, reset } = useClaude({
    apiKey,
    initialMessages,
  })

  const [localError, setLocalError] = useState<string | null>(null)
  const [followUpInput, setFollowUpInput] = useState("")
  const followUpInputRef = useRef<HTMLInputElement>(null)

  // Handle sending the journal entry to Claude
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
      {/* Submit button */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading || !apiKey}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Ask Claude"
        >
          {isLoading ?
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Thinking...
            </span>
          : "Ask Claude"}
        </button>

        {messages.length > 0 && (
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border px-4 py-2 transition-colors disabled:opacity-50"
            aria-label="Clear conversation"
          >
            Clear
          </button>
        )}
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
              data-testid={message.role === "user" ? "user-message" : "claude-response"}
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
        <div className="flex gap-2">
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
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Follow-up message"
          />
          <button
            onClick={handleFollowUp}
            disabled={isLoading || !followUpInput.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send follow-up"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      )}

      {/* No API key message */}
      {!apiKey && (
        <p className="text-muted-foreground text-sm">
          To use Claude, please add your API key in{" "}
          <a href="#/settings" className="hover:text-foreground underline">
            Settings
          </a>
          .
        </p>
      )}
    </div>
  )
}
