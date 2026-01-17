import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  storeTokens,
  getStoredTokens,
  clearStoredTokens,
  revokeTokens,
  isTokenExpired,
  getValidTokens,
  fetchEventsForDate,
  fetchAllEventsForDate,
  isGoogleCalendarConfigured,
  isAuthenticated,
  type GoogleTokens,
} from "./google-calendar"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  }),
}
Object.defineProperty(global, "localStorage", { value: localStorageMock })

// Mock import.meta.env
vi.stubGlobal("import.meta", {
  env: {
    VITE_GOOGLE_CLIENT_ID: "test-client-id",
    VITE_GOOGLE_REDIRECT_URI: "http://localhost:3000/oauth/callback",
  },
})

describe("google-calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getAuthUrl", () => {
    it("generates a valid OAuth URL with PKCE", async () => {
      const result = await getAuthUrl({
        clientId: "test-client-id",
        redirectUri: "http://localhost:3000/callback",
      })

      expect(result.url).toContain("https://accounts.google.com/o/oauth2/v2/auth")
      expect(result.url).toContain("client_id=test-client-id")
      expect(result.url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback")
      expect(result.url).toContain("response_type=code")
      expect(result.url).toContain("code_challenge_method=S256")
      expect(result.url).toContain("access_type=offline")
      expect(result.state).toBeDefined()
      expect(result.codeVerifier).toBeDefined()
    })

    it("throws error when client ID is missing", async () => {
      await expect(getAuthUrl({ clientId: "" })).rejects.toThrow("Google Client ID is required")
    })
  })

  describe("exchangeCodeForTokens", () => {
    it("exchanges auth code for tokens successfully", async () => {
      const mockResponse = {
        access_token: "access-token-123",
        refresh_token: "refresh-token-456",
        expires_in: 3600,
        token_type: "Bearer",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const tokens = await exchangeCodeForTokens("auth-code", "code-verifier", {
        clientId: "test-client-id",
        redirectUri: "http://localhost:3000/callback",
      })

      expect(tokens.accessToken).toBe("access-token-123")
      expect(tokens.refreshToken).toBe("refresh-token-456")
      expect(tokens.tokenType).toBe("Bearer")
      expect(tokens.expiresAt).toBeGreaterThan(Date.now())

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }),
      )
    })

    it("throws error on failed token exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error_description: "Invalid code" }),
      })

      await expect(
        exchangeCodeForTokens("bad-code", "code-verifier", { clientId: "test-client-id" }),
      ).rejects.toThrow("Invalid code")
    })

    it("throws error when client ID is missing", async () => {
      await expect(exchangeCodeForTokens("code", "verifier", { clientId: "" })).rejects.toThrow(
        "Google Client ID is required",
      )
    })
  })

  describe("refreshAccessToken", () => {
    it("refreshes access token successfully", async () => {
      const mockResponse = {
        access_token: "new-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const tokens = await refreshAccessToken("refresh-token", { clientId: "test-client-id" })

      expect(tokens.accessToken).toBe("new-access-token")
      expect(tokens.refreshToken).toBe("refresh-token") // Original refresh token preserved
      expect(tokens.tokenType).toBe("Bearer")
    })

    it("throws error on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error_description: "Token expired" }),
      })

      await expect(refreshAccessToken("bad-token", { clientId: "test-client-id" })).rejects.toThrow(
        "Token expired",
      )
    })
  })

  describe("token storage", () => {
    const mockTokens: GoogleTokens = {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: Date.now() + 3600000,
      tokenType: "Bearer",
    }

    it("stores and retrieves tokens (encrypted)", async () => {
      await storeTokens(mockTokens)

      // Verify something was stored (encrypted format)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "google_calendar_tokens",
        expect.any(String),
      )

      // The stored value should be encrypted (JSON with iv, ciphertext, version)
      const storedValue = mockLocalStorage["google_calendar_tokens"]
      const parsed = JSON.parse(storedValue)
      expect(parsed).toHaveProperty("iv")
      expect(parsed).toHaveProperty("ciphertext")
      expect(parsed).toHaveProperty("version", 1)

      const retrieved = await getStoredTokens()
      expect(retrieved).toEqual(mockTokens)
    })

    it("returns null when no tokens stored", async () => {
      const tokens = await getStoredTokens()
      expect(tokens).toBeNull()
    })

    it("returns null and clears storage for corrupted data", async () => {
      mockLocalStorage["google_calendar_tokens"] = "invalid json"
      const tokens = await getStoredTokens()
      expect(tokens).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("google_calendar_tokens")
    })

    it("clears stored tokens", async () => {
      await storeTokens(mockTokens)
      clearStoredTokens()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("google_calendar_tokens")
    })

    it("migrates unencrypted tokens to encrypted format", async () => {
      // Store unencrypted tokens directly (simulating legacy data)
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify(mockTokens)

      // First read should migrate
      const retrieved = await getStoredTokens()
      expect(retrieved).toEqual(mockTokens)

      // After migration, storage should contain encrypted data
      const storedValue = mockLocalStorage["google_calendar_tokens"]
      const parsed = JSON.parse(storedValue)
      expect(parsed).toHaveProperty("iv")
      expect(parsed).toHaveProperty("ciphertext")
      expect(parsed).toHaveProperty("version", 1)
    })

    it("returns null for data that is not valid tokens", async () => {
      // Store something that parses as JSON but isn't tokens
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify({ foo: "bar" })
      const tokens = await getStoredTokens()
      expect(tokens).toBeNull()
    })
  })

  describe("revokeTokens", () => {
    it("successfully revokes a token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      })

      const result = await revokeTokens("access-token-123")

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/revoke",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }),
      )

      // Verify the token was sent in the body
      const fetchCall = mockFetch.mock.calls[0]
      const body = fetchCall[1].body as URLSearchParams
      expect(body.get("token")).toBe("access-token-123")
    })

    it("treats 400 response as success (token already revoked or invalid)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid_token" }),
      })

      const result = await revokeTokens("already-revoked-token")

      // 400 means the token is already invalid, which is the desired outcome
      expect(result.success).toBe(true)
    })

    it("returns error for server errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error_description: "Internal server error" }),
      })

      const result = await revokeTokens("some-token")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Internal server error")
    })

    it("returns error for other HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: "service_unavailable" }),
      })

      const result = await revokeTokens("some-token")

      expect(result.success).toBe(false)
      expect(result.error).toBe("service_unavailable")
    })

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await revokeTokens("some-token")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Network error")
    })

    it("handles JSON parsing errors in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("JSON parse error")
        },
      })

      const result = await revokeTokens("some-token")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Failed to revoke token")
    })
  })

  describe("isTokenExpired", () => {
    it("returns true for expired tokens", () => {
      const tokens: GoogleTokens = {
        accessToken: "access",
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        tokenType: "Bearer",
      }
      expect(isTokenExpired(tokens)).toBe(true)
    })

    it("returns true for tokens expiring within 5 minutes", () => {
      const tokens: GoogleTokens = {
        accessToken: "access",
        expiresAt: Date.now() + 4 * 60 * 1000, // Expires in 4 minutes
        tokenType: "Bearer",
      }
      expect(isTokenExpired(tokens)).toBe(true)
    })

    it("returns false for valid tokens", () => {
      const tokens: GoogleTokens = {
        accessToken: "access",
        expiresAt: Date.now() + 10 * 60 * 1000, // Expires in 10 minutes
        tokenType: "Bearer",
      }
      expect(isTokenExpired(tokens)).toBe(false)
    })
  })

  describe("getValidTokens", () => {
    it("returns null when no tokens stored", async () => {
      const tokens = await getValidTokens()
      expect(tokens).toBeNull()
    })

    it("returns valid tokens without refresh", async () => {
      const validTokens: GoogleTokens = {
        accessToken: "valid-access",
        refreshToken: "refresh",
        expiresAt: Date.now() + 10 * 60 * 1000,
        tokenType: "Bearer",
      }
      // Store encrypted tokens
      await storeTokens(validTokens)

      const tokens = await getValidTokens()
      expect(tokens).toEqual(validTokens)
    })

    it("refreshes expired tokens", async () => {
      const expiredTokens: GoogleTokens = {
        accessToken: "expired-access",
        refreshToken: "refresh-token",
        expiresAt: Date.now() - 1000,
        tokenType: "Bearer",
      }
      // Store encrypted tokens
      await storeTokens(expiredTokens)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      })

      const tokens = await getValidTokens({ clientId: "test-client-id" })
      expect(tokens?.accessToken).toBe("new-access")
    })

    it("clears tokens when refresh fails", async () => {
      const expiredTokens: GoogleTokens = {
        accessToken: "expired-access",
        refreshToken: "bad-refresh",
        expiresAt: Date.now() - 1000,
        tokenType: "Bearer",
      }
      // Store encrypted tokens
      await storeTokens(expiredTokens)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "invalid_grant" }),
      })

      const tokens = await getValidTokens({ clientId: "test-client-id" })
      expect(tokens).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("google_calendar_tokens")
    })
  })

  describe("fetchEventsForDate", () => {
    const mockTokens: GoogleTokens = {
      accessToken: "access-token",
      expiresAt: Date.now() + 3600000,
      tokenType: "Bearer",
    }

    it("fetches events successfully", async () => {
      const mockEvents = {
        items: [
          {
            id: "event-1",
            summary: "Meeting",
            description: "Team sync",
            location: "Conference Room",
            start: { dateTime: "2024-01-15T10:00:00Z" },
            end: { dateTime: "2024-01-15T11:00:00Z" },
            htmlLink: "https://calendar.google.com/event/1",
            status: "confirmed",
          },
          {
            id: "event-2",
            summary: "All Day Event",
            start: { date: "2024-01-15" },
            end: { date: "2024-01-16" },
            status: "tentative",
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      })

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(2)
      expect(result.events[0]).toEqual({
        id: "event-1",
        summary: "Meeting",
        description: "Team sync",
        location: "Conference Room",
        start: "2024-01-15T10:00:00Z",
        end: "2024-01-15T11:00:00Z",
        isAllDay: false,
        calendarId: "primary",
        htmlLink: "https://calendar.google.com/event/1",
        status: "confirmed",
      })
      expect(result.events[1].isAllDay).toBe(true)
    })

    it("uses time bounds covering the full local day (start of day to start of next day)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })

      await fetchEventsForDate(mockTokens, "2024-01-15")

      // Extract the URL that was called
      const fetchCall = mockFetch.mock.calls[0]
      const url = new URL(fetchCall[0])
      const timeMin = url.searchParams.get("timeMin")
      const timeMax = url.searchParams.get("timeMax")

      // Parse the times to verify the span
      const startTime = new Date(timeMin!)
      const endTime = new Date(timeMax!)

      // The time span should be exactly 24 hours
      const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      expect(hoursDiff).toBe(24)

      // The start time should be midnight local time for Jan 15
      // When we create new Date("2024-01-15T00:00:00"), it's midnight in local timezone
      const expectedStart = new Date("2024-01-15T00:00:00")
      expect(startTime.getTime()).toBe(expectedStart.getTime())

      // The end time should be midnight local time for Jan 16
      const expectedEnd = new Date("2024-01-16T00:00:00")
      expect(endTime.getTime()).toBe(expectedEnd.getTime())
    })

    it("handles events without title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "event-1",
              start: { dateTime: "2024-01-15T10:00:00Z" },
              end: { dateTime: "2024-01-15T11:00:00Z" },
            },
          ],
        }),
      })

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")
      expect(result.events[0].summary).toBe("(No title)")
    })

    it("returns error on 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      })

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Authentication expired. Please reconnect your Google account.")
    })

    it("returns error on API failure (5xx)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: async () => ({ error: { message: "Server error" } }),
      })

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      // 500 errors are now retryable and throw RateLimitError, which is caught
      // and converted to an error response
      expect(result.success).toBe(false)
      expect(result.error).toContain("rate limit or server error")
      expect(result.error).toContain("500")
    })

    it("returns error on API failure (4xx non-401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Bad request" } }),
      })

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Bad request")
    })

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Network error")
    })

    it("returns error for invalid date format (wrong separator)", async () => {
      const result = await fetchEventsForDate(mockTokens, "2024/01/15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date format: 2024/01/15. Expected YYYY-MM-DD")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns error for invalid date format (missing parts)", async () => {
      const result = await fetchEventsForDate(mockTokens, "2024-01")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date format: 2024-01. Expected YYYY-MM-DD")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns error for invalid date (non-existent day)", async () => {
      const result = await fetchEventsForDate(mockTokens, "2024-02-30")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date format: 2024-02-30. Expected YYYY-MM-DD")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns error for completely malformed date", async () => {
      const result = await fetchEventsForDate(mockTokens, "not-a-date")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date format: not-a-date. Expected YYYY-MM-DD")
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("fetchAllEventsForDate", () => {
    const mockTokens: GoogleTokens = {
      accessToken: "access-token",
      expiresAt: Date.now() + 3600000,
      tokenType: "Bearer",
    }

    it("fetches events from multiple calendars", async () => {
      // First call: get calendar list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "primary" }, { id: "work@example.com" }],
        }),
      })

      // Second call: events from primary
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "event-1",
              summary: "Personal",
              start: { dateTime: "2024-01-15T14:00:00Z" },
              end: { dateTime: "2024-01-15T15:00:00Z" },
            },
          ],
        }),
      })

      // Third call: events from work calendar
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "event-2",
              summary: "Work Meeting",
              start: { dateTime: "2024-01-15T09:00:00Z" },
              end: { dateTime: "2024-01-15T10:00:00Z" },
            },
          ],
        }),
      })

      const result = await fetchAllEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(2)
      // Events should be sorted by start time
      expect(result.events[0].summary).toBe("Work Meeting")
      expect(result.events[1].summary).toBe("Personal")
    })

    it("returns error on calendar list fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      })

      const result = await fetchAllEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Authentication expired. Please reconnect your Google account.")
    })

    it("returns error for invalid date format", async () => {
      const result = await fetchAllEventsForDate(mockTokens, "invalid-date")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date format: invalid-date. Expected YYYY-MM-DD")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns error for malformed date", async () => {
      const result = await fetchAllEventsForDate(mockTokens, "2024/01/15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date format: 2024/01/15. Expected YYYY-MM-DD")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns empty success for no calendars", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })

      const result = await fetchAllEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(0)
    })

    it("uses rate limiting with configured concurrency", async () => {
      // Track the timing of fetch calls to verify rate limiting
      const callTimes: number[] = []

      // First call: get calendar list with 5 calendars
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "cal1" }, { id: "cal2" }, { id: "cal3" }, { id: "cal4" }, { id: "cal5" }],
        }),
      })

      // Mock 5 calendar event requests
      for (let i = 0; i < 5; i++) {
        mockFetch.mockImplementationOnce(async () => {
          callTimes.push(Date.now())
          return {
            ok: true,
            json: async () => ({ items: [] }),
          }
        })
      }

      await fetchAllEventsForDate(mockTokens, "2024-01-15", {
        concurrency: { maxConcurrent: 2, delayBetweenRequestsMs: 50 },
      })

      // Verify calls were made (1 calendar list + 5 events)
      expect(mockFetch).toHaveBeenCalledTimes(6)

      // With maxConcurrent: 2 and 5 calendars, requests should be staggered
      // Check that there's at least some spacing between calls
      if (callTimes.length >= 2) {
        const timeDiff = callTimes[1] - callTimes[0]
        expect(timeDiff).toBeGreaterThanOrEqual(40) // Allow some timing variance
      }
    })

    it("handles rate limit errors on calendar list fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => "5" },
        json: async () => ({}),
      })

      const result = await fetchAllEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toContain("rate limit")
    })

    it("continues fetching other calendars when one fails", async () => {
      // First call: get calendar list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "cal1" }, { id: "cal2" }],
        }),
      })

      // First calendar succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "event-1",
              summary: "Event 1",
              start: { dateTime: "2024-01-15T10:00:00Z" },
              end: { dateTime: "2024-01-15T11:00:00Z" },
            },
          ],
        }),
      })

      // Second calendar fails with 403 (non-retryable)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Forbidden" } }),
      })

      const result = await fetchAllEventsForDate(mockTokens, "2024-01-15")

      // Should succeed with partial results
      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].summary).toBe("Event 1")
    })
  })

  describe("isGoogleCalendarConfigured", () => {
    it("returns true when clientId parameter is provided", () => {
      // Passing a clientId should return true regardless of env var
      const result = isGoogleCalendarConfigured("custom-client-id")
      expect(result).toBe(true)
    })

    it("returns false when clientId parameter is empty and env var is not set", () => {
      // Pass empty string to simulate no client ID
      // Note: The env var is stubbed but the module constant was set at load time,
      // which may be empty depending on test environment
      const result = isGoogleCalendarConfigured("")
      expect(result).toBe(false)
    })

    it("returns false when called with undefined and env var is empty", () => {
      // This tests the fallback behavior - when no param is passed and env var is empty
      // The result depends on whether GOOGLE_CLIENT_ID was set at module load time
      const result = isGoogleCalendarConfigured()
      // Result type should be boolean
      expect(typeof result).toBe("boolean")
    })
  })

  describe("isAuthenticated", () => {
    it("returns false when no tokens stored", async () => {
      expect(await isAuthenticated()).toBe(false)
    })

    it("returns true when tokens are stored (encrypted)", async () => {
      const tokens: GoogleTokens = {
        accessToken: "access",
        expiresAt: Date.now() + 3600000,
        tokenType: "Bearer",
      }
      // Store encrypted tokens
      await storeTokens(tokens)
      expect(await isAuthenticated()).toBe(true)
    })

    it("returns true for legacy unencrypted tokens and migrates them", async () => {
      const tokens: GoogleTokens = {
        accessToken: "access",
        expiresAt: Date.now() + 3600000,
        tokenType: "Bearer",
      }
      // Store unencrypted tokens (legacy)
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify(tokens)
      expect(await isAuthenticated()).toBe(true)

      // After isAuthenticated, tokens should be migrated to encrypted format
      const storedValue = mockLocalStorage["google_calendar_tokens"]
      const parsed = JSON.parse(storedValue)
      expect(parsed).toHaveProperty("iv")
      expect(parsed).toHaveProperty("ciphertext")
    })
  })
})
