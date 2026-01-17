/**
 * TypeScript interfaces for the Journal app's Automerge documents
 */

import type { GeoPosition } from "../hooks/useGeolocation"

/**
 * Branded type for ISO date strings (YYYY-MM-DD format).
 * This provides compile-time type safety to ensure only valid date strings are used as keys.
 */
export type DateString = string & { readonly __brand: "DateString" }

/**
 * Type guard to check if a string is a valid DateString (YYYY-MM-DD format representing a real date)
 * @param s - String to validate
 * @returns true if the string is a valid DateString, false otherwise
 */
export function isDateString(s: string): s is DateString {
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return false
  }

  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // JavaScript months are 0-indexed
  const day = parseInt(dayStr, 10)

  const date = new Date(year, month, day)

  // Validate that the date components are valid
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
}

/**
 * Converts a string to a DateString, throwing an error if invalid.
 * Use this when you have a string that should be a valid date.
 * @param s - String to convert
 * @returns DateString if valid
 * @throws Error if the string is not a valid date format
 */
export function toDateString(s: string): DateString {
  if (!isDateString(s)) {
    throw new Error(`Invalid date format: ${s}. Expected YYYY-MM-DD`)
  }
  return s
}

/**
 * Converts a string to a DateString if valid, otherwise returns undefined.
 * Use this when you want to safely attempt conversion without throwing.
 * @param s - String to convert
 * @returns DateString if valid, undefined otherwise
 */
export function toDateStringOrUndefined(s: string): DateString | undefined {
  return isDateString(s) ? s : undefined
}

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
  date: DateString
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
  /** Map of date strings to journal entries, keyed by YYYY-MM-DD format dates */
  entries: Record<DateString, JournalEntry>
  /** User settings */
  settings: Settings
}
