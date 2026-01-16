/**
 * Google Calendar integration library
 * Handles OAuth flow and Calendar API to fetch events
 */

// Google OAuth configuration
// These should be set up in a Google Cloud project with Calendar API enabled
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
const GOOGLE_REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? `${window.location.origin}/oauth/callback`

// OAuth and API endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

// Scopes needed for calendar access
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
].join(" ")

// Local storage keys for token persistence
const TOKEN_STORAGE_KEY = "google_calendar_tokens"

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
  clientId?: string
  /** OAuth redirect URI */
  redirectUri?: string
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
 * Store tokens in local storage
 */
export function storeTokens(tokens: GoogleTokens): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
}

/**
 * Retrieve tokens from local storage
 */
export function getStoredTokens(): GoogleTokens | null {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as GoogleTokens
  } catch {
    return null
  }
}

/**
 * Clear stored tokens (for logout)
 */
export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
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
  const tokens = getStoredTokens()
  if (!tokens) return null

  if (!isTokenExpired(tokens)) {
    return tokens
  }

  // Try to refresh the token
  if (tokens.refreshToken) {
    try {
      const newTokens = await refreshAccessToken(tokens.refreshToken, config)
      storeTokens(newTokens)
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
  try {
    // Create time bounds for the date (full day in local timezone)
    const startOfDay = new Date(`${date}T00:00:00`)
    const endOfDay = new Date(`${date}T23:59:59`)

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
 * Fetch events from all accessible calendars for a specific date
 *
 * @param tokens - Valid OAuth tokens
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of calendar events from all calendars
 */
export async function fetchAllEventsForDate(
  tokens: GoogleTokens,
  date: string,
): Promise<CalendarEventsResponse> {
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
      return {
        events: [],
        success: false,
        error: "Failed to fetch calendar list",
      }
    }

    const calendarListData = await calendarListResponse.json()
    const calendars: { id: string }[] = calendarListData.items ?? []

    // Fetch events from all calendars in parallel
    const eventPromises = calendars.map(calendar => fetchEventsForDate(tokens, date, calendar.id))
    const results = await Promise.all(eventPromises)

    // Combine all events
    const allEvents: CalendarEvent[] = []
    const errors: string[] = []

    for (const result of results) {
      if (result.success) {
        allEvents.push(...result.events)
      } else if (result.error) {
        errors.push(result.error)
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
 */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID)
}

/**
 * Check if user is authenticated with Google
 */
export function isAuthenticated(): boolean {
  const tokens = getStoredTokens()
  return tokens !== null
}
