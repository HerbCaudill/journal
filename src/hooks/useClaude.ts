import { useState, useCallback, useRef } from "react"
import { sendMessage, type ClaudeConfig, type ClaudeResponse } from "@/lib/claude"
import type { Message } from "@/types/journal"

/**
 * Options for configuring the useClaude hook
 */
export interface UseClaudeOptions {
  /** Anthropic API key */
  apiKey: string
  /** Model to use (defaults to claude-sonnet-4-20250514) */
  model?: string
  /** Maximum tokens in the response */
  maxTokens?: number
  /** Initial messages to start the conversation with */
  initialMessages?: Message[]
}

/**
 * Return type for the useClaude hook
 */
export interface UseClaudeReturn {
  /** Current conversation messages */
  messages: Message[]
  /** Whether a message is currently being sent */
  isLoading: boolean
  /** Error message if the last request failed */
  error: string | null
  /** Send a new message to Claude */
  send: (content: string) => Promise<ClaudeResponse>
  /** Clear all messages and reset the conversation */
  reset: () => void
  /** Set messages directly (useful for loading saved conversations) */
  setMessages: (messages: Message[]) => void
}

/**
 * Generate a unique ID for a message
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Custom hook for managing conversation state with Claude.
 * Handles sending messages, receiving responses, and tracking loading/error states.
 *
 * @param options - Configuration options including API key and optional model settings
 * @returns Object containing messages, loading state, error, and control functions
 *
 * @example
 * ```tsx
 * const { messages, isLoading, error, send, reset } = useClaude({
 *   apiKey: "your-api-key",
 * })
 *
 * // Send a message
 * await send("How can I reflect on my day?")
 *
 * // Reset the conversation
 * reset()
 * ```
 */
export function useClaude(options: UseClaudeOptions): UseClaudeReturn {
  const { apiKey, model, maxTokens, initialMessages = [] } = options

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to always have access to the current messages, avoiding stale closure issues
  // when send is called rapidly in succession
  const messagesRef = useRef<Message[]>(messages)
  messagesRef.current = messages

  const send = useCallback(
    async (content: string): Promise<ClaudeResponse> => {
      if (!content.trim()) {
        return {
          content: "",
          success: false,
          error: "Message content cannot be empty",
        }
      }

      setIsLoading(true)
      setError(null)

      // Create the user message
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        createdAt: Date.now(),
      }

      // Update the ref synchronously BEFORE the async operation starts
      // This ensures rapid consecutive calls see the accumulated messages
      const currentMessages = messagesRef.current
      messagesRef.current = [...currentMessages, userMessage]

      // Also update React state for UI rendering
      setMessages(messagesRef.current)

      const config: ClaudeConfig = {
        apiKey,
        model,
        maxTokens,
      }

      // Use currentMessages (before adding userMessage) for the API call
      // The API expects the history without the current user message
      const response = await sendMessage(config, currentMessages, content.trim())

      if (response.success) {
        // Add the assistant's response
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: response.content,
          createdAt: Date.now(),
        }
        // Update ref synchronously, then state
        messagesRef.current = [...messagesRef.current, assistantMessage]
        setMessages(messagesRef.current)
      } else {
        // Remove the optimistically added user message on error
        // Find and remove the specific userMessage to handle race conditions correctly
        messagesRef.current = messagesRef.current.filter(m => m.id !== userMessage.id)
        setMessages(messagesRef.current)
        setError(response.error ?? "An unknown error occurred")
      }

      setIsLoading(false)
      return response
    },
    [apiKey, model, maxTokens],
  )

  const reset = useCallback(() => {
    messagesRef.current = []
    setMessages([])
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    messages,
    isLoading,
    error,
    send,
    reset,
    setMessages,
  }
}
