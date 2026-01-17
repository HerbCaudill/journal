import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getValidTokens,
  storeTokens,
  clearStoredTokens,
  fetchAllEventsForDate,
  isGoogleCalendarConfigured,
  type CalendarEvent,
  type GoogleCalendarConfig,
} from "../lib/google-calendar"

/**
 * Authentication state for Google Calendar
 */
export type GoogleCalendarAuthState =
  | "unconfigured"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"

/**
 * Options for the useGoogleCalendar hook
 */
export interface UseGoogleCalendarOptions {
  /** Google OAuth client ID (optional, uses env var if not provided) */
  clientId?: string
  /** OAuth redirect URI (optional, uses env var if not provided) */
  redirectUri?: string
}

/**
 * Return type for the useGoogleCalendar hook
 */
export interface UseGoogleCalendarReturn {
  /** Current authentication state */
  authState: GoogleCalendarAuthState
  /** Whether events are currently being fetched */
  isLoading: boolean
  /** Error message if the last operation failed */
  error: string | null
  /** Array of calendar events for the requested date */
  events: CalendarEvent[]
  /** Start the OAuth authentication flow */
  authenticate: () => Promise<void>
  /** Handle the OAuth callback (call this when returning from Google) */
  handleCallback: (code: string, state: string) => Promise<boolean>
  /** Fetch events for a specific date (YYYY-MM-DD format) */
  fetchEvents: (date: string) => Promise<CalendarEvent[]>
  /** Sign out and clear stored tokens */
  signOut: () => void
  /** Clear the current error */
  clearError: () => void
}

// Session storage keys for OAuth state
const OAUTH_STATE_KEY = "google_oauth_state"
const OAUTH_VERIFIER_KEY = "google_oauth_verifier"

/**
 * Custom hook for Google Calendar integration.
 * Handles OAuth authentication and event fetching.
 *
 * @param options - Configuration options for Google Calendar
 * @returns Object containing auth state, events, and control functions
 *
 * @example
 * ```tsx
 * const { authState, events, isLoading, authenticate, fetchEvents } = useGoogleCalendar()
 *
 * // Check if user needs to authenticate
 * if (authState === 'unauthenticated') {
 *   return <button onClick={authenticate}>Connect Google Calendar</button>
 * }
 *
 * // Fetch events for today
 * useEffect(() => {
 *   if (authState === 'authenticated') {
 *     fetchEvents('2024-01-15')
 *   }
 * }, [authState])
 * ```
 */
export function useGoogleCalendar(options: UseGoogleCalendarOptions = {}): UseGoogleCalendarReturn {
  // Memoize config to prevent unnecessary re-renders and effect re-runs
  const config: GoogleCalendarConfig = useMemo(
    () => ({
      clientId: options.clientId,
      redirectUri: options.redirectUri,
    }),
    [options.clientId, options.redirectUri],
  )

  // Start with 'unauthenticated' and let useEffect determine the actual state
  // since checkIsAuthenticated is now async
  const [authState, setAuthState] = useState<GoogleCalendarAuthState>(() => {
    if (!isGoogleCalendarConfigured(options.clientId)) {
      return "unconfigured"
    }
    return "unauthenticated"
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Track the last fetched date to avoid duplicate requests
  const lastFetchedDateRef = useRef<string | null>(null)
  // Track if we're currently fetching to prevent double-fetches
  const isFetchingRef = useRef(false)
  // Track current events to avoid stale closure issues in fetchEvents
  const eventsRef = useRef<CalendarEvent[]>([])
  eventsRef.current = events

  // Check authentication status on mount and when config changes
  useEffect(() => {
    if (!isGoogleCalendarConfigured(options.clientId)) {
      setAuthState("unconfigured")
      return
    }

    // Check if we have valid tokens
    const checkAuth = async () => {
      const tokens = await getValidTokens(config)
      setAuthState(tokens ? "authenticated" : "unauthenticated")
    }

    checkAuth()
  }, [options.clientId])

  /**
   * Start the OAuth authentication flow
   */
  const authenticate = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      setAuthState("authenticating")

      const { url, state, codeVerifier } = await getAuthUrl(config)

      // Store state and verifier for callback verification
      sessionStorage.setItem(OAUTH_STATE_KEY, state)
      sessionStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier)

      // Redirect to Google OAuth
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authentication")
      setAuthState("unauthenticated")
    }
  }, [config])

  /**
   * Handle the OAuth callback after user authorizes
   */
  const handleCallback = useCallback(
    async (code: string, state: string): Promise<boolean> => {
      try {
        setError(null)
        setAuthState("authenticating")

        // Verify state matches
        const storedState = sessionStorage.getItem(OAUTH_STATE_KEY)
        const storedVerifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY)

        // Clean up session storage
        sessionStorage.removeItem(OAUTH_STATE_KEY)
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)

        if (!storedState || state !== storedState) {
          throw new Error("Invalid OAuth state - possible CSRF attack")
        }

        if (!storedVerifier) {
          throw new Error("Missing code verifier - please try authenticating again")
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, storedVerifier, config)
        await storeTokens(tokens)

        setAuthState("authenticated")
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed")
        setAuthState("unauthenticated")
        return false
      }
    },
    [config],
  )

  /**
   * Fetch events for a specific date
   */
  const fetchEvents = useCallback(
    async (date: string): Promise<CalendarEvent[]> => {
      // Prevent concurrent fetches for the same date
      // Use ref to avoid stale closure issue with events state
      if (isFetchingRef.current && lastFetchedDateRef.current === date) {
        return eventsRef.current
      }

      if (authState !== "authenticated") {
        setError("Not authenticated with Google Calendar")
        return []
      }

      try {
        isFetchingRef.current = true
        lastFetchedDateRef.current = date
        setIsLoading(true)
        setError(null)

        const tokens = await getValidTokens(config)
        if (!tokens) {
          setAuthState("unauthenticated")
          setError("Authentication expired. Please reconnect your Google account.")
          return []
        }

        const response = await fetchAllEventsForDate(tokens, date)

        if (!response.success) {
          // Check if it's an auth error
          if (response.error?.includes("Authentication expired")) {
            setAuthState("unauthenticated")
          }
          setError(response.error ?? "Failed to fetch events")
          return []
        }

        setEvents(response.events)
        return response.events
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events")
        return []
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [authState, config],
  )

  /**
   * Sign out and clear stored tokens
   */
  const signOut = useCallback(() => {
    clearStoredTokens()
    setAuthState("unauthenticated")
    setEvents([])
    setError(null)
    lastFetchedDateRef.current = null
  }, [])

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    authState,
    isLoading,
    error,
    events,
    authenticate,
    handleCallback,
    fetchEvents,
    signOut,
    clearError,
  }
}
