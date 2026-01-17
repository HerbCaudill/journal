/**
 * Date utilities for the Journal app
 * All dates are stored and handled as ISO format strings (YYYY-MM-DD)
 */

import type { DateString } from "../types/journal"

/**
 * Formats a Date object to an ISO date string (YYYY-MM-DD)
 * @param date - The Date object to format
 * @returns DateString in YYYY-MM-DD format
 */
export function formatDate(date: Date): DateString {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}` as DateString
}

/**
 * Checks if a string is a valid ISO date (YYYY-MM-DD) representing a real date.
 * Note: This is a runtime validation check. For type-safe date strings, use the
 * isDateString type guard from src/types/journal.ts instead.
 * @param dateString - String to validate
 * @returns true if the string is a valid ISO date, false otherwise
 */
export function isValidDate(dateString: string): boolean {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
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
 * Parses an ISO date string (YYYY-MM-DD) to a Date object
 * @param dateString - ISO date string in YYYY-MM-DD format (can be DateString or plain string)
 * @returns Date object set to midnight local time on that date
 * @throws Error if the date string is invalid
 */
export function parseDate(dateString: DateString | string): Date {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`)
  }

  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // JavaScript months are 0-indexed
  const day = parseInt(dayStr, 10)

  const date = new Date(year, month, day)

  // Validate that the date components are valid
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    throw new Error(`Invalid date: ${dateString}`)
  }

  return date
}

/**
 * Gets today's date as an ISO date string (YYYY-MM-DD)
 * @returns DateString for today
 */
export function getToday(): DateString {
  return formatDate(new Date())
}

/**
 * Checks if a date is in the future (after today)
 * @param dateString - ISO date string in YYYY-MM-DD format (can be DateString or plain string)
 * @returns true if the date is after today, false otherwise
 */
export function isFutureDate(dateString: DateString | string): boolean {
  return dateString > getToday()
}

/**
 * Adds (or subtracts) days from a date
 * @param dateString - ISO date string in YYYY-MM-DD format (can be DateString or plain string)
 * @param days - Number of days to add (negative to subtract)
 * @returns DateString for the resulting date
 */
export function addDays(dateString: DateString | string, days: number): DateString {
  const date = parseDate(dateString)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}
