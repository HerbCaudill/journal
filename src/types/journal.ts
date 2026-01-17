/**
 * TypeScript interfaces for the Journal app's Automerge documents
 */

import type { GeoPosition } from "../hooks/useGeolocation"

/**
 * A single message within a journal entry (conversation turn)
 */
export interface Message {
  /** Unique identifier for the message */
  id: string
  /** Role of the message sender */
  role: "user" | "assistant"
  /** The message content */
  content: string
  /** Timestamp when the message was created */
  createdAt: number
}

/**
 * A journal entry representing a single day's conversation
 */
export interface JournalEntry {
  /** Unique identifier for the entry */
  id: string
  /** Date of the entry in ISO format (YYYY-MM-DD) */
  date: string
  /** Array of messages in this entry */
  messages: Message[]
  /** Geographic position captured for this entry (optional) */
  position?: GeoPosition
  /** Timestamp when the entry was created */
  createdAt: number
  /** Timestamp when the entry was last updated */
  updatedAt: number
}

/**
 * Supported LLM provider types for AI integration
 */
export type LLMProviderType = "claude" | "openai"

/**
 * User settings for the journal app
 */
export interface Settings {
  /** User's display name */
  displayName: string
  /** User's timezone for date calculations */
  timezone: string
  /** Theme preference */
  theme: "light" | "dark" | "system"
  /** Selected LLM provider for AI integration */
  llmProvider: LLMProviderType
  /** Claude API key for AI integration */
  claudeApiKey?: string
  /** OpenAI API key for AI integration */
  openaiApiKey?: string
  /** User's bio - helps the AI understand context about the user */
  bio?: string
  /** Additional instructions for customizing AI behavior */
  additionalInstructions?: string
}

/**
 * The root Automerge document structure for the journal
 */
export interface JournalDoc {
  /** Map of entry IDs to journal entries */
  entries: Record<string, JournalEntry>
  /** User settings */
  settings: Settings
}
