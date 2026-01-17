/**
 * Google Calendar integration library
 * Handles OAuth flow and Calendar API to fetch events
 */

import {
  deriveEncryptionKey,
  encrypt,
  decrypt,
  isEncryptedData,
  type EncryptedData,
} from "./crypto"
import { isValidDate } from "./dates"
import {
  withConcurrencyAndRetry,
  RateLimitError,
  type ConcurrencyConfig,
  type RetryConfig,
} from "./rate-limiter"

// Google OAuth configuration
// These should be set up in a Google Cloud project with Calendar API enabled
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
const GOOGLE_REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_REDIRECT_URI ??
  (typeof window !== "undefined" ? `${window.location.origin}/oauth/callback` : "")

// OAuth and API endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

// Scopes needed for calendar access
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
].join(" ")

// Local storage keys for token persistence
const TOKEN_STORAGE_KEY = "google_calendar_tokens"
const TOKEN_ISSUED_AT_KEY = "google_calendar_token_issued_at"

// Token rotation threshold - rotate tokens if older than 30 minutes
// This limits the exposure window if tokens are compromised
const TOKEN_ROTATION_THRESHOLD_MS = 30 * 60 * 1000

// Rate limiting configuration for Google Calendar API
// Google's Calendar API has a limit of 10 requests per second per user
// We use conservative defaults to stay well under this limit
const DEFAULT_CALENDAR_CONCURRENCY: ConcurrencyConfig = {
  maxConcurrent: 3, // Max parallel calendar requests
  delayBetweenRequestsMs: 100, // Small delay between starting requests
}

const DEFAULT_CALENDAR_RETRY: RetryConfig = {
  maxRetries: 3, // Retry up to 3 times
  initialDelayMs: 1000, // Start with 1 second delay
  maxDelayMs: 30000, // Cap at 30 seconds
  backoffMultiplier: 2, // Double the delay each retry
  jitterFactor: 0.1, // Add 10% jitter
}

/**
 * OAuth tokens returned from Google
 */
export interface GoogleTokens {
  /** Access token for API calls */
  accessToken: string
  /** Refresh token to get new access tokens */
  refreshToken?: string
  /** Token expiration timestamp */
  expiresAt: number
  /** Token type (usually "Bearer") */
  tokenType: string
}

/**
 * A calendar event from Google Calendar
 */
export interface CalendarEvent {
  /** Event ID */
  id: string
  /** Event title/summary */
  summary: string
  /** Event description (optional) */
  description?: string
  /** Event location (optional) */
  location?: string
  /** Start time as ISO string */
  start: string
  /** End time as ISO string */
  end: string
  /** Whether this is an all-day event */
  isAllDay: boolean
  /** Calendar ID this event belongs to */
  calendarId: string
  /** HTML link to the event */
  htmlLink?: string
  /** Event status */
  status: "confirmed" | "tentative" | "cancelled"
}

/**
 * Response from fetching calendar events
 */
export interface CalendarEventsResponse {
  /** Array of events */
  events: CalendarEvent[]
  /** Whether the request was successful */
  success: boolean
  /** Error message if the request failed */
  error?: string
}

/**
 * Configuration for the Google Calendar client
 */
export interface GoogleCalendarConfig {
  /** Google OAuth client ID */
  clientId?: string | undefined
  /** OAuth redirect URI */
  redirectUri?: string | undefined
}

/**
 * Generate a cryptographically random state parameter for OAuth
 */
function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Generate a PKCE code verifier
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generate a PKCE code challenge from a verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Base64URL encode a Uint8Array
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Get the OAuth authorization URL to redirect the user to
 */
export async function getAuthUrl(config: GoogleCalendarConfig = {}): Promise<{
  url: string
  state: string
  codeVerifier: string
}> {
  const clientId = config.clientId ?? GOOGLE_CLIENT_ID
  const redirectUri = config.redirectUri ?? GOOGLE_REDIRECT_URI

  if (!clientId) {
    throw new Error("Google Client ID is required")
  }

  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  })

  return {
    url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    state,
    codeVerifier,
  }
}

/**
 * Exchange an authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  config: GoogleCalendarConfig = {},
): Promise<GoogleTokens> {
  const clientId = config.clientId ?? GOOGLE_CLIENT_ID
  const redirectUri = config.redirectUri ?? GOOGLE_REDIRECT_URI

  if (!clientId) {
    throw new Error("Google Client ID is required")
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error_description ?? "Failed to exchange code for tokens")
  }

  const data = await response.json()

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
  }

  return tokens
}

/**
 * Refresh an expired access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: GoogleCalendarConfig = {},
): Promise<GoogleTokens> {
  const clientId = config.clientId ?? GOOGLE_CLIENT_ID

  if (!clientId) {
    throw new Error("Google Client ID is required")
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error_description ?? "Failed to refresh access token")
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: refreshToken, // Keep the original refresh token
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
  }
}

/**
 * Store tokens in local storage (encrypted)
 * Also records the timestamp when the tokens were issued/refreshed
 */
export async function storeTokens(tokens: GoogleTokens): Promise<void> {
  const key = await deriveEncryptionKey()
  const encryptedData = await encrypt(JSON.stringify(tokens), key)
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(encryptedData))
  // Record when tokens were stored for rotation tracking
  localStorage.setItem(TOKEN_ISSUED_AT_KEY, Date.now().toString())
}

/**
 * Get the timestamp when tokens were last issued/refreshed
 */
export function getTokenIssuedAt(): number | null {
  const storedValue = localStorage.getItem(TOKEN_ISSUED_AT_KEY)
  if (!storedValue) return null
  const timestamp = parseInt(storedValue, 10)
  return Number.isNaN(timestamp) ? null : timestamp
}

/**
 * Retrieve tokens from local storage (decrypts if encrypted, migrates if unencrypted)
 */
export async function getStoredTokens(): Promise<GoogleTokens | null> {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!stored) return null

  try {
    // Check if the stored value is encrypted
    if (isEncryptedData(stored)) {
      const key = await deriveEncryptionKey()
      const encryptedData = JSON.parse(stored) as EncryptedData
      const decrypted = await decrypt(encryptedData, key)
      return JSON.parse(decrypted) as GoogleTokens
    }

    // Handle unencrypted tokens (migration path)
    const tokens = JSON.parse(stored) as GoogleTokens
    // Validate that it looks like tokens and not some other data
    if (tokens && typeof tokens.accessToken === "string" && typeof tokens.expiresAt === "number") {
      // Migrate to encrypted storage
      await storeTokens(tokens)
      return tokens
    }

    return null
  } catch {
    // If decryption fails or data is corrupted, clear the tokens
    clearStoredTokens()
    return null
  }
}

/**
 * Clear stored tokens (for logout)
 */
export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(TOKEN_ISSUED_AT_KEY)
}

/**
 * Result of a token revocation attempt
 */
export interface RevokeTokensResult {
  /** Whether the revocation was successful */
  success: boolean
  /** Error message if the revocation failed */
  error?: string
}

/**
 * Revoke OAuth tokens by calling Google's revocation endpoint.
 *
 * This should be called when the user signs out to properly invalidate
 * the tokens on Google's side, not just clear them locally.
 *
 * Note: Even if revocation fails, local tokens should still be cleared
 * to prevent further use. The caller should handle this.
 *
 * @param token - The access token or refresh token to revoke.
 *                Revoking one will invalidate both tokens.
 * @returns Promise resolving to the revocation result
 */
export async function revokeTokens(token: string): Promise<RevokeTokensResult> {
  try {
    const response = await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
      }),
    })

    // Google's revocation endpoint returns 200 on success
    // It may return 400 if the token is already revoked or invalid,
    // which we consider a success (token is not usable either way)
    if (response.ok || response.status === 400) {
      return { success: true }
    }

    // For other errors, try to get error details
    const errorData = await response.json().catch(() => ({}))
    return {
      success: false,
      error: errorData.error_description ?? errorData.error ?? "Failed to revoke token",
    }
  } catch (error) {
    // Network errors or other failures
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revoke token",
    }
  }
}

/**
 * Check if tokens are expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(tokens: GoogleTokens): boolean {
  const bufferMs = 5 * 60 * 1000 // 5 minutes buffer
  return Date.now() >= tokens.expiresAt - bufferMs
}

/**
 * Get valid tokens, refreshing if necessary
 */
export async function getValidTokens(
  config: GoogleCalendarConfig = {},
): Promise<GoogleTokens | null> {
  const tokens = await getStoredTokens()
  if (!tokens) return null

  if (!isTokenExpired(tokens)) {
    return tokens
  }

  // Try to refresh the token
  if (tokens.refreshToken) {
    try {
      const newTokens = await refreshAccessToken(tokens.refreshToken, config)
      await storeTokens(newTokens)
      return newTokens
    } catch {
      // Refresh failed, clear tokens
      clearStoredTokens()
      return null
    }
  }

  // No refresh token available, clear tokens
  clearStoredTokens()
  return null
}

/**
 * Check if tokens should be proactively rotated based on their age.
 * Returns true if tokens are older than the rotation threshold.
 *
 * @param issuedAt - Timestamp when tokens were issued (in milliseconds)
 * @param thresholdMs - Rotation threshold in milliseconds (default: 30 minutes)
 */
export function shouldRotateTokens(
  issuedAt: number | null,
  thresholdMs: number = TOKEN_ROTATION_THRESHOLD_MS,
): boolean {
  // If no issue timestamp, assume we should rotate
  if (issuedAt === null) return true

  const age = Date.now() - issuedAt
  return age >= thresholdMs
}

/**
 * Result of a token rotation attempt
 */
export interface RotateTokensResult {
  /** Whether rotation was performed */
  rotated: boolean
  /** New tokens if rotation was successful */
  tokens?: GoogleTokens
  /** Error message if rotation failed */
  error?: string
}

/**
 * Proactively rotate tokens if they're older than the rotation threshold.
 * This limits the exposure window if tokens are compromised.
 *
 * Called on app startup to ensure tokens are fresh. Unlike getValidTokens,
 * this function may refresh tokens even if they haven't expired yet.
 *
 * @param config - Google Calendar configuration
 * @param thresholdMs - Rotation threshold in milliseconds (default: 30 minutes)
 * @returns Result indicating whether rotation occurred and any errors
 */
export async function rotateTokensIfNeeded(
  config: GoogleCalendarConfig = {},
  thresholdMs: number = TOKEN_ROTATION_THRESHOLD_MS,
): Promise<RotateTokensResult> {
  const tokens = await getStoredTokens()

  // No tokens stored, nothing to rotate
  if (!tokens) {
    return { rotated: false }
  }

  // No refresh token, can't rotate
  if (!tokens.refreshToken) {
    return { rotated: false }
  }

  const issuedAt = getTokenIssuedAt()

  // Check if rotation is needed
  if (!shouldRotateTokens(issuedAt, thresholdMs)) {
    return { rotated: false }
  }

  // Perform rotation
  try {
    const newTokens = await refreshAccessToken(tokens.refreshToken, config)
    await storeTokens(newTokens)
    return { rotated: true, tokens: newTokens }
  } catch (error) {
    // Don't clear tokens on rotation failure - they may still be valid
    // The user can still use existing tokens until they actually expire
    return {
      rotated: false,
      error: error instanceof Error ? error.message : "Failed to rotate tokens",
    }
  }
}

/**
 * Parse a Google Calendar event datetime
 */
function parseEventDateTime(dateTime: { date?: string; dateTime?: string }): {
  timestamp: string
  isAllDay: boolean
} {
  if (dateTime.date) {
    // All-day event - date only, no time
    return {
      timestamp: dateTime.date,
      isAllDay: true,
    }
  }
  return {
    timestamp: dateTime.dateTime ?? "",
    isAllDay: false,
  }
}

/**
 * Fetch calendar events for a specific date
 *
 * @param tokens - Valid OAuth tokens
 * @param date - Date in YYYY-MM-DD format
 * @param calendarId - Calendar ID (defaults to "primary")
 * @returns Array of calendar events for the specified date
 */
export async function fetchEventsForDate(
  tokens: GoogleTokens,
  date: string,
  calendarId: string = "primary",
): Promise<CalendarEventsResponse> {
  // Validate date format
  if (!isValidDate(date)) {
    return {
      events: [],
      success: false,
      error: `Invalid date format: ${date}. Expected YYYY-MM-DD`,
    }
  }

  try {
    // Create time bounds for the date in the user's local timezone.
    // We use local timezone because the user's "day" is defined by their local clock.
    // For example, if a user in UTC-8 wants events for Jan 15:
    //   - startOfDay: Jan 15 00:00:00 local = Jan 15 08:00:00 UTC
    //   - endOfDay: Jan 16 00:00:00 local = Jan 16 08:00:00 UTC (exclusive)
    // This ensures we capture all events that occur during the user's local day.
    const startOfDay = new Date(`${date}T00:00:00`)

    // Calculate end of day as start of the next day (more precise than 23:59:59)
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    })

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: {
          Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
        },
      },
    )

    if (!response.ok) {
      if (response.status === 401) {
        return {
          events: [],
          success: false,
          error: "Authentication expired. Please reconnect your Google account.",
        }
      }
      // Handle rate limiting (429) and server errors (5xx) with retryable errors
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get("Retry-After")
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined
        throw new RateLimitError(
          `API rate limit or server error (${response.status})`,
          response.status,
          Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
        )
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        events: [],
        success: false,
        error: errorData.error?.message ?? "Failed to fetch calendar events",
      }
    }

    const data = await response.json()

    const events: CalendarEvent[] = (data.items ?? []).map(
      (item: {
        id: string
        summary?: string
        description?: string
        location?: string
        start: { date?: string; dateTime?: string }
        end: { date?: string; dateTime?: string }
        htmlLink?: string
        status?: string
      }) => {
        const start = parseEventDateTime(item.start)
        const end = parseEventDateTime(item.end)

        return {
          id: item.id,
          summary: item.summary ?? "(No title)",
          description: item.description,
          location: item.location,
          start: start.timestamp,
          end: end.timestamp,
          isAllDay: start.isAllDay,
          calendarId,
          htmlLink: item.htmlLink,
          status: (item.status ?? "confirmed") as CalendarEvent["status"],
        }
      },
    )

    return {
      events,
      success: true,
    }
  } catch (error) {
    return {
      events: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Options for fetching events with rate limiting
 */
export interface FetchAllEventsOptions {
  /** Override default concurrency settings */
  concurrency?: ConcurrencyConfig
  /** Override default retry settings */
  retry?: RetryConfig
}

/**
 * Fetch events from all accessible calendars for a specific date.
 *
 * Uses controlled concurrency and exponential backoff to avoid hitting
 * Google's API rate limits (10 requests/second per user).
 *
 * @param tokens - Valid OAuth tokens
 * @param date - Date in YYYY-MM-DD format
 * @param options - Optional rate limiting configuration
 * @returns Array of calendar events from all calendars
 */
export async function fetchAllEventsForDate(
  tokens: GoogleTokens,
  date: string,
  options: FetchAllEventsOptions = {},
): Promise<CalendarEventsResponse> {
  // Validate date format
  if (!isValidDate(date)) {
    return {
      events: [],
      success: false,
      error: `Invalid date format: ${date}. Expected YYYY-MM-DD`,
    }
  }

  const concurrencyConfig = { ...DEFAULT_CALENDAR_CONCURRENCY, ...options.concurrency }
  const retryConfig = { ...DEFAULT_CALENDAR_RETRY, ...options.retry }

  try {
    // First, get the list of calendars
    const calendarListResponse = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
      },
    })

    if (!calendarListResponse.ok) {
      if (calendarListResponse.status === 401) {
        return {
          events: [],
          success: false,
          error: "Authentication expired. Please reconnect your Google account.",
        }
      }
      // Handle rate limiting on calendar list fetch
      if (calendarListResponse.status === 429 || calendarListResponse.status >= 500) {
        const retryAfter = calendarListResponse.headers.get("Retry-After")
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined
        throw new RateLimitError(
          `API rate limit or server error (${calendarListResponse.status})`,
          calendarListResponse.status,
          Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
        )
      }
      return {
        events: [],
        success: false,
        error: "Failed to fetch calendar list",
      }
    }

    const calendarListData = await calendarListResponse.json()
    const calendars: { id: string }[] = calendarListData.items ?? []

    // If no calendars, return empty success
    if (calendars.length === 0) {
      return {
        events: [],
        success: true,
      }
    }

    // Fetch events from all calendars with rate limiting and retries
    // Each task is a function that fetches events for one calendar
    const tasks = calendars.map(calendar => async () => {
      const result = await fetchEventsForDate(tokens, date, calendar.id)
      // If fetchEventsForDate returns an error (not a thrown exception),
      // convert it to a thrown error so the retry logic can handle it
      if (!result.success && result.error) {
        // Only throw for transient errors, not for auth or validation errors
        if (
          result.error.includes("rate limit") ||
          result.error.includes("server error") ||
          result.error.includes("429") ||
          result.error.includes("5")
        ) {
          throw new Error(result.error)
        }
      }
      return result
    })

    const results = await withConcurrencyAndRetry(tasks, concurrencyConfig, retryConfig)

    // Combine all events
    const allEvents: CalendarEvent[] = []
    const errors: string[] = []

    for (const result of results) {
      if (result.success && result.value) {
        // Result from successful rate-limited call
        if (result.value.success) {
          allEvents.push(...result.value.events)
        } else if (result.value.error) {
          errors.push(result.value.error)
        }
      } else if (result.error) {
        // Result from failed rate-limited call (after all retries)
        errors.push(result.error.message)
      }
    }

    // Sort all events by start time
    allEvents.sort((a, b) => {
      const aTime = new Date(a.start).getTime()
      const bTime = new Date(b.start).getTime()
      return aTime - bTime
    })

    // Return success if we got any events, even if some calendars failed
    if (allEvents.length > 0 || errors.length === 0) {
      return {
        events: allEvents,
        success: true,
      }
    }

    return {
      events: [],
      success: false,
      error: errors[0], // Return the first error
    }
  } catch (error) {
    return {
      events: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Check if Google Calendar is configured
 * @param clientId - Optional client ID to check (in addition to env var)
 */
export function isGoogleCalendarConfigured(clientId?: string): boolean {
  return Boolean(clientId ?? GOOGLE_CLIENT_ID)
}

/**
 * Check if user is authenticated with Google
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getStoredTokens()
  return tokens !== null
}
