/**
 * LLM Provider Abstraction Layer
 *
 * This module defines provider-agnostic interfaces for LLM integration,
 * enabling support for multiple LLM providers (Claude, OpenAI, etc.)
 */

import type { Message } from "@/types/journal"

/**
 * Supported LLM provider types
 */
export type ProviderType = "claude" | "openai"

/**
 * Provider-agnostic configuration for LLM clients
 */
export interface LLMConfig {
  /** API key for the provider */
  apiKey: string
  /** Model identifier (provider-specific) */
  model?: string | undefined
  /** Maximum tokens in the response */
  maxTokens?: number | undefined
  /** User's bio - helps the AI understand context about the user */
  bio?: string | undefined
  /** Additional instructions for customizing AI behavior */
  additionalInstructions?: string | undefined
}

/**
 * Response from sending a message to an LLM provider
 */
export interface LLMResponse {
  /** The assistant's response content */
  content: string
  /** Whether the request was successful */
  success: boolean
  /** Error message if the request failed */
  error?: string
  /** Updated messages array after the send operation (includes user message and assistant response) */
  messages?: Message[]
}

/**
 * Interface that all LLM providers must implement
 */
export interface LLMProvider {
  /** The type of this provider */
  readonly type: ProviderType

  /**
   * Send a message to the LLM and get a response
   *
   * @param messages - Array of previous messages in the conversation
   * @param userMessage - The new user message to send
   * @returns The assistant's response
   */
  sendMessage(messages: Message[], userMessage: string): Promise<LLMResponse>
}

/**
 * Factory function type for creating LLM providers
 */
export type LLMProviderFactory = (config: LLMConfig) => LLMProvider

/**
 * Registry of available LLM provider factories
 */
export interface LLMProviderRegistry {
  [key: string]: LLMProviderFactory
}

/**
 * Default model identifiers for each provider
 */
export const DEFAULT_MODELS: Record<ProviderType, string> = {
  claude: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
}

/**
 * Default max tokens for responses
 */
export const DEFAULT_MAX_TOKENS = 4096
