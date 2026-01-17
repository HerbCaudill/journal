import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useGoogleCalendar } from "./useGoogleCalendar"
import * as googleCalendar from "../lib/google-calendar"

// Mock the google-calendar module
vi.mock("../lib/google-calendar", () => ({
  getAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  getValidTokens: vi.fn(),
  getStoredTokens: vi.fn(),
  storeTokens: vi.fn().mockResolvedValue(undefined),
  clearStoredTokens: vi.fn(),
  revokeTokens: vi.fn(),
  fetchAllEventsForDate: vi.fn(),
  isGoogleCalendarConfigured: vi.fn(),
  isAuthenticated: vi.fn().mockResolvedValue(false),
  rotateTokensIfNeeded: vi.fn().mockResolvedValue({ rotated: false }),
}))

describe("useGoogleCalendar", () => {
  const mockTokens: googleCalendar.GoogleTokens = {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresAt: Date.now() + 3600000,
    tokenType: "Bearer",
  }

  const mockEvents: googleCalendar.CalendarEvent[] = [
    {
      id: "event-1",
      summary: "Team Meeting",
      start: "2024-01-15T10:00:00",
      end: "2024-01-15T11:00:00",
      isAllDay: false,
      calendarId: "primary",
      status: "confirmed",
    },
    {
      id: "event-2",
      summary: "Lunch",
      start: "2024-01-15T12:00:00",
      end: "2024-01-15T13:00:00",
      isAllDay: false,
      calendarId: "primary",
      status: "confirmed",
    },
  ]

  // Store original location href
  let originalHref: string

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset sessionStorage
    sessionStorage.clear()

    // Default mocks
    vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
    vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(false)
    vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)
    vi.mocked(googleCalendar.getStoredTokens).mockResolvedValue(null)
    vi.mocked(googleCalendar.storeTokens).mockResolvedValue(undefined)
    vi.mocked(googleCalendar.revokeTokens).mockResolvedValue({ success: true })
    vi.mocked(googleCalendar.rotateTokensIfNeeded).mockResolvedValue({ rotated: false })

    // Store and mock window.location.href
    originalHref = window.location.href
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "" },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: originalHref },
      writable: true,
    })
  })

  describe("initialization", () => {
    it("initializes with unconfigured state when not configured", () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(false)

      const { result } = renderHook(() => useGoogleCalendar())

      expect(result.current.authState).toBe("unconfigured")
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.events).toEqual([])
    })

    it("initializes with unauthenticated state when configured but not authenticated", () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(false)

      const { result } = renderHook(() => useGoogleCalendar())

      expect(result.current.authState).toBe("unauthenticated")
    })

    it("initializes with authenticated state when authenticated", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)

      const { result } = renderHook(() => useGoogleCalendar())

      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })
    })

    it("uses provided clientId to override configuration check", async () => {
      // When no clientId is passed, return false (unconfigured)
      // When clientId is passed, return true (configured)
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockImplementation((clientId?: string) =>
        Boolean(clientId),
      )
      vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(false)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)

      const { result } = renderHook(() => useGoogleCalendar({ clientId: "custom-client-id" }))

      await waitFor(() => {
        expect(result.current.authState).toBe("unauthenticated")
      })
    })
  })

  describe("authenticate", () => {
    it("starts OAuth flow and redirects to Google", async () => {
      const mockAuthUrl = {
        url: "https://accounts.google.com/o/oauth2/v2/auth?...",
        state: "mock-state",
        codeVerifier: "mock-verifier",
      }
      vi.mocked(googleCalendar.getAuthUrl).mockResolvedValue(mockAuthUrl)

      const { result } = renderHook(() => useGoogleCalendar())

      await act(async () => {
        await result.current.authenticate()
      })

      expect(googleCalendar.getAuthUrl).toHaveBeenCalled()
      expect(sessionStorage.getItem("google_oauth_state")).toBe("mock-state")
      expect(sessionStorage.getItem("google_oauth_verifier")).toBe("mock-verifier")
      expect(window.location.href).toBe(mockAuthUrl.url)
    })

    it("sets authenticating state during authentication", async () => {
      let resolveAuth: (value: { url: string; state: string; codeVerifier: string }) => void
      vi.mocked(googleCalendar.getAuthUrl).mockReturnValue(
        new Promise(resolve => {
          resolveAuth = resolve
        }),
      )

      const { result } = renderHook(() => useGoogleCalendar())

      act(() => {
        result.current.authenticate()
      })

      await waitFor(() => {
        expect(result.current.authState).toBe("authenticating")
      })

      await act(async () => {
        resolveAuth!({
          url: "https://accounts.google.com/...",
          state: "state",
          codeVerifier: "verifier",
        })
      })
    })

    it("handles authentication errors", async () => {
      vi.mocked(googleCalendar.getAuthUrl).mockRejectedValue(
        new Error("Google Client ID is required"),
      )

      const { result } = renderHook(() => useGoogleCalendar())

      await act(async () => {
        await result.current.authenticate()
      })

      expect(result.current.authState).toBe("unauthenticated")
      expect(result.current.error).toBe("Google Client ID is required")
    })
  })

  describe("handleCallback", () => {
    it("exchanges code for tokens and stores them", async () => {
      // Setup session storage with state and verifier
      sessionStorage.setItem("google_oauth_state", "valid-state")
      sessionStorage.setItem("google_oauth_verifier", "valid-verifier")

      vi.mocked(googleCalendar.exchangeCodeForTokens).mockResolvedValue(mockTokens)

      const { result } = renderHook(() => useGoogleCalendar())

      let success: boolean
      await act(async () => {
        success = await result.current.handleCallback("auth-code", "valid-state")
      })

      expect(success!).toBe(true)
      expect(googleCalendar.exchangeCodeForTokens).toHaveBeenCalledWith(
        "auth-code",
        "valid-verifier",
        expect.any(Object),
      )
      expect(googleCalendar.storeTokens).toHaveBeenCalledWith(mockTokens)
      expect(result.current.authState).toBe("authenticated")
      expect(sessionStorage.getItem("google_oauth_state")).toBeNull()
      expect(sessionStorage.getItem("google_oauth_verifier")).toBeNull()
    })

    it("rejects invalid state parameter", async () => {
      sessionStorage.setItem("google_oauth_state", "stored-state")
      sessionStorage.setItem("google_oauth_verifier", "verifier")

      const { result } = renderHook(() => useGoogleCalendar())

      let success: boolean
      await act(async () => {
        success = await result.current.handleCallback("code", "wrong-state")
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe("Invalid OAuth state - possible CSRF attack")
      expect(result.current.authState).toBe("unauthenticated")
    })

    it("handles missing code verifier", async () => {
      sessionStorage.setItem("google_oauth_state", "valid-state")
      // No verifier stored

      const { result } = renderHook(() => useGoogleCalendar())

      let success: boolean
      await act(async () => {
        success = await result.current.handleCallback("code", "valid-state")
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe("Missing code verifier - please try authenticating again")
    })

    it("handles token exchange errors", async () => {
      sessionStorage.setItem("google_oauth_state", "valid-state")
      sessionStorage.setItem("google_oauth_verifier", "verifier")

      vi.mocked(googleCalendar.exchangeCodeForTokens).mockRejectedValue(
        new Error("Invalid authorization code"),
      )

      const { result } = renderHook(() => useGoogleCalendar())

      let success: boolean
      await act(async () => {
        success = await result.current.handleCallback("code", "valid-state")
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe("Invalid authorization code")
      expect(result.current.authState).toBe("unauthenticated")
    })
  })

  describe("fetchEvents", () => {
    it("fetches events for a specific date", async () => {
      vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.fetchAllEventsForDate).mockResolvedValue({
        events: mockEvents,
        success: true,
      })

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      let fetchedEvents: googleCalendar.CalendarEvent[]
      await act(async () => {
        fetchedEvents = await result.current.fetchEvents("2024-01-15")
      })

      expect(fetchedEvents!).toEqual(mockEvents)
      expect(result.current.events).toEqual(mockEvents)
      expect(googleCalendar.fetchAllEventsForDate).toHaveBeenCalledWith(mockTokens, "2024-01-15")
    })

    it("sets loading state while fetching", async () => {
      vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      // Setup a controlled getValidTokens for the fetchEvents call
      let resolveTokens: (value: googleCalendar.GoogleTokens) => void
      vi.mocked(googleCalendar.getValidTokens).mockReturnValue(
        new Promise(resolve => {
          resolveTokens = resolve
        }),
      )

      act(() => {
        result.current.fetchEvents("2024-01-15")
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      vi.mocked(googleCalendar.fetchAllEventsForDate).mockResolvedValue({
        events: [],
        success: true,
      })

      await act(async () => {
        resolveTokens!(mockTokens)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("returns error when not authenticated", async () => {
      vi.mocked(googleCalendar.isAuthenticated).mockResolvedValue(false)

      const { result } = renderHook(() => useGoogleCalendar())

      let fetchedEvents: googleCalendar.CalendarEvent[]
      await act(async () => {
        fetchedEvents = await result.current.fetchEvents("2024-01-15")
      })

      expect(fetchedEvents!).toEqual([])
      expect(result.current.error).toBe("Not authenticated with Google Calendar")
    })

    it("handles expired tokens", async () => {
      // Initial check says authenticated, but getValidTokens returns null (expired)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      // Now make getValidTokens return null for the fetchEvents call
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)

      await act(async () => {
        await result.current.fetchEvents("2024-01-15")
      })

      expect(result.current.authState).toBe("unauthenticated")
      expect(result.current.error).toBe(
        "Authentication expired. Please reconnect your Google account.",
      )
    })

    it("handles fetch errors", async () => {
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.fetchAllEventsForDate).mockResolvedValue({
        events: [],
        success: false,
        error: "Failed to fetch calendar events",
      })

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      await act(async () => {
        await result.current.fetchEvents("2024-01-15")
      })

      expect(result.current.error).toBe("Failed to fetch calendar events")
      expect(result.current.events).toEqual([])
    })

    it("handles authentication expired error from API", async () => {
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.fetchAllEventsForDate).mockResolvedValue({
        events: [],
        success: false,
        error: "Authentication expired. Please reconnect your Google account.",
      })

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      await act(async () => {
        await result.current.fetchEvents("2024-01-15")
      })

      expect(result.current.authState).toBe("unauthenticated")
    })
  })

  describe("signOut", () => {
    it("revokes tokens and clears state", async () => {
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.getStoredTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.fetchAllEventsForDate).mockResolvedValue({
        events: mockEvents,
        success: true,
      })
      vi.mocked(googleCalendar.revokeTokens).mockResolvedValue({ success: true })

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      // First fetch some events
      await act(async () => {
        await result.current.fetchEvents("2024-01-15")
      })

      expect(result.current.events).toHaveLength(2)

      // Then sign out
      await act(async () => {
        await result.current.signOut()
      })

      // Should have revoked tokens using refresh token (preferred)
      expect(googleCalendar.revokeTokens).toHaveBeenCalledWith(mockTokens.refreshToken)
      expect(googleCalendar.clearStoredTokens).toHaveBeenCalled()
      expect(result.current.authState).toBe("unauthenticated")
      expect(result.current.events).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it("uses access token for revocation when no refresh token", async () => {
      const tokensWithoutRefresh: googleCalendar.GoogleTokens = {
        accessToken: "mock-access-token",
        expiresAt: Date.now() + 3600000,
        tokenType: "Bearer",
      }
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(tokensWithoutRefresh)
      vi.mocked(googleCalendar.getStoredTokens).mockResolvedValue(tokensWithoutRefresh)
      vi.mocked(googleCalendar.revokeTokens).mockResolvedValue({ success: true })

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      await act(async () => {
        await result.current.signOut()
      })

      // Should have revoked tokens using access token
      expect(googleCalendar.revokeTokens).toHaveBeenCalledWith(tokensWithoutRefresh.accessToken)
      expect(googleCalendar.clearStoredTokens).toHaveBeenCalled()
    })

    it("clears local tokens even when revocation fails", async () => {
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.getStoredTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.revokeTokens).mockResolvedValue({
        success: false,
        error: "Network error",
      })

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      await act(async () => {
        await result.current.signOut()
      })

      // Even though revocation failed, local tokens should be cleared
      expect(googleCalendar.clearStoredTokens).toHaveBeenCalled()
      expect(result.current.authState).toBe("unauthenticated")
    })

    it("clears local tokens even when revocation throws", async () => {
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.getStoredTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.revokeTokens).mockRejectedValue(new Error("Network error"))

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      await act(async () => {
        await result.current.signOut()
      })

      // Even though revocation threw, local tokens should be cleared
      expect(googleCalendar.clearStoredTokens).toHaveBeenCalled()
      expect(result.current.authState).toBe("unauthenticated")
    })

    it("skips revocation when no tokens are stored", async () => {
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)
      vi.mocked(googleCalendar.getStoredTokens).mockResolvedValue(null)

      const { result } = renderHook(() => useGoogleCalendar())

      // Wait for auth state to be authenticated
      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      await act(async () => {
        await result.current.signOut()
      })

      // Should not have attempted revocation
      expect(googleCalendar.revokeTokens).not.toHaveBeenCalled()
      // But should still clear local storage
      expect(googleCalendar.clearStoredTokens).toHaveBeenCalled()
      expect(result.current.authState).toBe("unauthenticated")
    })
  })

  describe("clearError", () => {
    it("clears the current error", async () => {
      vi.mocked(googleCalendar.getAuthUrl).mockRejectedValue(new Error("Test error"))

      const { result } = renderHook(() => useGoogleCalendar())

      await act(async () => {
        await result.current.authenticate()
      })

      expect(result.current.error).toBe("Test error")

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe("memoization", () => {
    it("returns the same object reference when values have not changed", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)

      const { result, rerender } = renderHook(() => useGoogleCalendar())

      // Get first render result
      const firstResult = result.current

      // Force re-render without changing any values
      rerender()

      // The return object should be the same reference (memoized)
      expect(result.current).toBe(firstResult)
    })

    it("returns a new object reference when values change", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)

      const { result } = renderHook(() => useGoogleCalendar())

      // Get first render result
      const firstResult = result.current

      // Trigger a state change that should cause a new object reference
      vi.mocked(googleCalendar.getAuthUrl).mockRejectedValue(new Error("Test error"))
      await act(async () => {
        await result.current.authenticate()
      })

      // The return object should be a new reference since error state changed
      expect(result.current).not.toBe(firstResult)
      expect(result.current.error).toBe("Test error")
    })
  })

  describe("proactive token rotation", () => {
    it("calls rotateTokensIfNeeded on initialization when configured", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)
      vi.mocked(googleCalendar.rotateTokensIfNeeded).mockResolvedValue({ rotated: false })

      renderHook(() => useGoogleCalendar())

      await waitFor(() => {
        expect(googleCalendar.rotateTokensIfNeeded).toHaveBeenCalled()
      })
    })

    it("does not call rotateTokensIfNeeded when not configured", () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(false)

      renderHook(() => useGoogleCalendar())

      expect(googleCalendar.rotateTokensIfNeeded).not.toHaveBeenCalled()
    })

    it("becomes authenticated after successful rotation", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.rotateTokensIfNeeded).mockResolvedValue({
        rotated: true,
        tokens: mockTokens,
      })
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)

      const { result } = renderHook(() => useGoogleCalendar())

      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      expect(googleCalendar.rotateTokensIfNeeded).toHaveBeenCalled()
    })

    it("remains authenticated even if rotation fails (tokens still valid)", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.rotateTokensIfNeeded).mockResolvedValue({
        rotated: false,
        error: "Network error",
      })
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(mockTokens)

      const { result } = renderHook(() => useGoogleCalendar())

      await waitFor(() => {
        expect(result.current.authState).toBe("authenticated")
      })

      // Rotation failed, but user should still be authenticated if tokens are valid
      expect(googleCalendar.rotateTokensIfNeeded).toHaveBeenCalled()
      expect(googleCalendar.getValidTokens).toHaveBeenCalled()
    })

    it("passes config to rotateTokensIfNeeded", async () => {
      vi.mocked(googleCalendar.isGoogleCalendarConfigured).mockReturnValue(true)
      vi.mocked(googleCalendar.getValidTokens).mockResolvedValue(null)
      vi.mocked(googleCalendar.rotateTokensIfNeeded).mockResolvedValue({ rotated: false })

      const customConfig = {
        clientId: "custom-client-id",
        redirectUri: "http://custom.com/callback",
      }
      renderHook(() => useGoogleCalendar(customConfig))

      await waitFor(() => {
        expect(googleCalendar.rotateTokensIfNeeded).toHaveBeenCalledWith(
          expect.objectContaining(customConfig),
        )
      })
    })
  })
})
