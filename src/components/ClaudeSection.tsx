import { useState, useCallback } from "react"
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

  // Handle resetting the conversation
  const handleReset = useCallback(() => {
    reset()
    setLocalError(null)
    if (onMessagesChange) {
      onMessagesChange([])
    }
  }, [reset, onMessagesChange])

  const displayError = localError || error

  // Filter to only show assistant messages in the response area
  const assistantMessages = messages.filter((m) => m.role === "assistant")

  return (
    <div className="flex flex-col gap-4">
      {/* Submit button */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading || !apiKey}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Ask Claude"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Thinking...
            </span>
          ) : (
            "Ask Claude"
          )}
        </button>

        {messages.length > 0 && (
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 text-muted-foreground hover:text-foreground border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Clear conversation"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error display */}
      {displayError && (
        <div
          role="alert"
          className="p-3 bg-destructive/10 text-destructive rounded-md text-sm"
        >
          {displayError}
        </div>
      )}

      {/* Response display */}
      {assistantMessages.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Claude's Response
          </h3>
          {assistantMessages.map((message) => (
            <div
              key={message.id}
              className="p-4 bg-muted rounded-md"
              data-testid="claude-response"
            >
              <p className="text-foreground whitespace-pre-wrap">
                {message.content}
              </p>
              <span className="text-xs text-muted-foreground mt-2 block">
                {formatTime(message.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* No API key message */}
      {!apiKey && (
        <p className="text-sm text-muted-foreground">
          To use Claude, please add your API key in{" "}
          <a href="#/settings" className="underline hover:text-foreground">
            Settings
          </a>
          .
        </p>
      )}
    </div>
  )
}
