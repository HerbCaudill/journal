/**
 * Date utilities for the Journal app
 * All dates are stored and handled as ISO format strings (YYYY-MM-DD)
 */

/**
 * Formats a Date object to an ISO date string (YYYY-MM-DD)
 * @param date - The Date object to format
 * @returns ISO date string in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Parses an ISO date string (YYYY-MM-DD) to a Date object
 * @param dateString - ISO date string in YYYY-MM-DD format
 * @returns Date object set to midnight local time on that date
 * @throws Error if the date string is invalid
 */
export function parseDate(dateString: string): Date {
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
 * @returns ISO date string for today
 */
export function getToday(): string {
  return formatDate(new Date())
}

/**
 * Adds (or subtracts) days from a date
 * @param dateString - ISO date string in YYYY-MM-DD format
 * @param days - Number of days to add (negative to subtract)
 * @returns ISO date string for the resulting date
 */
export function addDays(dateString: string, days: number): string {
  const date = parseDate(dateString)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}
