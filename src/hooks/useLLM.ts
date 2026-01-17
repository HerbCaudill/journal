import { useState, useCallback, useRef, useMemo, useEffect } from "react"
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
  model?: string | undefined
  /** Maximum tokens in the response */
  maxTokens?: number | undefined
  /** Initial messages to start the conversation with */
  initialMessages?: Message[]
  /** User's bio - helps the AI understand context about the user */
  bio?: string | undefined
  /** Additional instructions for customizing AI behavior */
  additionalInstructions?: string | undefined
  /** Unique key to identify the conversation context (e.g., date). When this changes, messages reset. */
  conversationKey?: string | undefined
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
  /** Edit a message and resend from that point, discarding all subsequent messages */
  editAndResend: (messageId: string, newContent: string) => Promise<LLMResponse>
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
  const {
    provider,
    apiKey,
    model,
    maxTokens,
    initialMessages = [],
    bio,
    additionalInstructions,
    conversationKey,
  } = options

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to always have access to the current messages, avoiding stale closure issues
  // when send is called rapidly in succession
  const messagesRef = useRef<Message[]>(messages)
  messagesRef.current = messages

  // Use a stable key to detect when initialMessages actually changes
  // This prevents infinite loops when initialMessages is recreated each render
  const initialMessagesKey = JSON.stringify(initialMessages.map(m => m.id))

  // Sync internal state when initialMessages or conversationKey changes (e.g., when navigating between days)
  // This ensures each day has its own isolated conversation
  // The conversationKey is essential for detecting when we navigate between days that both have empty messages
  useEffect(() => {
    setMessages(initialMessages)
    messagesRef.current = initialMessages
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessagesKey, conversationKey])

  // Create the provider instance, memoized based on config
  const llmProvider = useMemo(() => {
    const config: LLMConfig = { apiKey, model, maxTokens, bio, additionalInstructions }
    return createProvider(provider, config)
  }, [provider, apiKey, model, maxTokens, bio, additionalInstructions])

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
      // Return response with the current messages for persistence
      // This ensures the caller gets the actual messages created by useLLM,
      // not stale closure values
      return { ...response, messages: messagesRef.current }
    },
    [llmProvider],
  )

  const reset = useCallback(() => {
    messagesRef.current = []
    setMessages([])
    setError(null)
    setIsLoading(false)
  }, [])

  const editAndResend = useCallback(
    async (messageId: string, newContent: string): Promise<LLMResponse> => {
      if (!newContent.trim()) {
        return {
          content: "",
          success: false,
          error: "Message content cannot be empty",
        }
      }

      // Find the message index
      const messageIndex = messagesRef.current.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        return {
          content: "",
          success: false,
          error: "Message not found",
        }
      }

      const messageToEdit = messagesRef.current[messageIndex]
      if (messageToEdit.role !== "user") {
        return {
          content: "",
          success: false,
          error: "Can only edit user messages",
        }
      }

      setIsLoading(true)
      setError(null)

      // Create the updated user message
      const updatedMessage: Message = {
        ...messageToEdit,
        content: newContent.trim(),
        createdAt: Date.now(),
      }

      // Truncate all messages after and including this one, then add the updated message
      const messagesBeforeEdit = messagesRef.current.slice(0, messageIndex)
      messagesRef.current = [...messagesBeforeEdit, updatedMessage]
      setMessages(messagesRef.current)

      // Get the conversation history for the API call (messages before the edited one)
      const response = await llmProvider.sendMessage(messagesBeforeEdit, newContent.trim())

      if (response.success) {
        // Add the assistant's response
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: response.content,
          createdAt: Date.now(),
        }
        messagesRef.current = [...messagesRef.current, assistantMessage]
        setMessages(messagesRef.current)
      } else {
        // On error, keep the edited message but show the error
        setError(response.error ?? "An unknown error occurred")
      }

      setIsLoading(false)
      return { ...response, messages: messagesRef.current }
    },
    [llmProvider],
  )

  return {
    messages,
    isLoading,
    error,
    send,
    reset,
    setMessages,
    editAndResend,
  }
}
