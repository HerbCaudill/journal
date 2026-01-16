import type { Message } from "@/types/journal"
import type { LLMResponse } from "@/lib/llm/types"
import { useLLM, type UseLLMReturn } from "./useLLM"

/**
 * Options for configuring the useClaude hook
 * @deprecated Use UseLLMOptions from useLLM instead
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
 * @deprecated Use UseLLMReturn from useLLM instead
 */
export interface UseClaudeReturn {
  /** Current conversation messages */
  messages: Message[]
  /** Whether a message is currently being sent */
  isLoading: boolean
  /** Error message if the last request failed */
  error: string | null
  /** Send a new message to Claude */
  send: (content: string) => Promise<LLMResponse>
  /** Clear all messages and reset the conversation */
  reset: () => void
  /** Set messages directly (useful for loading saved conversations) */
  setMessages: (messages: Message[]) => void
}

/**
 * Custom hook for managing conversation state with Claude.
 * Handles sending messages, receiving responses, and tracking loading/error states.
 *
 * @deprecated Use useLLM hook with provider: "claude" instead. This hook is maintained
 * for backwards compatibility but will be removed in a future version.
 *
 * @param options - Configuration options including API key and optional model settings
 * @returns Object containing messages, loading state, error, and control functions
 *
 * @example
 * ```tsx
 * // Old way (deprecated):
 * const { messages, isLoading, error, send, reset } = useClaude({
 *   apiKey: "your-api-key",
 * })
 *
 * // New way (preferred):
 * const { messages, isLoading, error, send, reset } = useLLM({
 *   provider: "claude",
 *   apiKey: "your-api-key",
 * })
 * ```
 */
export function useClaude(options: UseClaudeOptions): UseClaudeReturn {
  const { apiKey, model, maxTokens, initialMessages = [] } = options

  return useLLM({
    provider: "claude",
    apiKey,
    model,
    maxTokens,
    initialMessages,
  }) as UseLLMReturn as UseClaudeReturn
}

// Re-export for backwards compatibility
export type { LLMResponse as ClaudeResponse } from "@/lib/llm/types"
