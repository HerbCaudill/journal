import { useState, useCallback, useRef, useMemo } from "react"
import type { Message } from "@/types/journal"
import type { LLMConfig, LLMProvider, LLMResponse, ProviderType } from "@/lib/llm/types"
import { createClaudeProvider } from "@/lib/llm/providers/claude"

/**
 * Options for configuring the useLLM hook
 */
export interface UseLLMOptions {
  /** The LLM provider to use */
  provider: ProviderType
  /** API key for the provider */
  apiKey: string
  /** Model to use (provider-specific, optional) */
  model?: string
  /** Maximum tokens in the response */
  maxTokens?: number
  /** Initial messages to start the conversation with */
  initialMessages?: Message[]
}

/**
 * Return type for the useLLM hook
 */
export interface UseLLMReturn {
  /** Current conversation messages */
  messages: Message[]
  /** Whether a message is currently being sent */
  isLoading: boolean
  /** Error message if the last request failed */
  error: string | null
  /** Send a new message to the LLM */
  send: (content: string) => Promise<LLMResponse>
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
 * Create an LLM provider instance based on the provider type
 */
function createProvider(provider: ProviderType, config: LLMConfig): LLMProvider {
  switch (provider) {
    case "claude":
      return createClaudeProvider(config)
    case "openai":
      // OpenAI provider not yet implemented
      throw new Error("OpenAI provider not yet implemented")
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Provider-agnostic hook for managing conversation state with an LLM.
 * Handles sending messages, receiving responses, and tracking loading/error states.
 *
 * @param options - Configuration options including provider type, API key, and optional model settings
 * @returns Object containing messages, loading state, error, and control functions
 *
 * @example
 * ```tsx
 * const { messages, isLoading, error, send, reset } = useLLM({
 *   provider: "claude",
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
export function useLLM(options: UseLLMOptions): UseLLMReturn {
  const { provider, apiKey, model, maxTokens, initialMessages = [] } = options

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to always have access to the current messages, avoiding stale closure issues
  // when send is called rapidly in succession
  const messagesRef = useRef<Message[]>(messages)
  messagesRef.current = messages

  // Create the provider instance, memoized based on config
  const llmProvider = useMemo(() => {
    const config: LLMConfig = { apiKey, model, maxTokens }
    return createProvider(provider, config)
  }, [provider, apiKey, model, maxTokens])

  const send = useCallback(
    async (content: string): Promise<LLMResponse> => {
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

      // Use currentMessages (before adding userMessage) for the API call
      // The provider expects the history without the current user message
      const response = await llmProvider.sendMessage(currentMessages, content.trim())

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
    [llmProvider],
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
