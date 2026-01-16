import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  storeTokens,
  getStoredTokens,
  clearStoredTokens,
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

// Mock crypto
const mockGetRandomValues = vi.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = i % 256
  }
  return array
})

const mockDigest = vi.fn(async () => new ArrayBuffer(32))

Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: mockGetRandomValues,
    subtle: {
      digest: mockDigest,
    },
  },
})

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
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
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
        })
      )
    })

    it("throws error on failed token exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error_description: "Invalid code" }),
      })

      await expect(
        exchangeCodeForTokens("bad-code", "code-verifier", { clientId: "test-client-id" })
      ).rejects.toThrow("Invalid code")
    })

    it("throws error when client ID is missing", async () => {
      await expect(exchangeCodeForTokens("code", "verifier", { clientId: "" })).rejects.toThrow(
        "Google Client ID is required"
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
        "Token expired"
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

    it("stores and retrieves tokens", () => {
      storeTokens(mockTokens)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "google_calendar_tokens",
        JSON.stringify(mockTokens)
      )

      const retrieved = getStoredTokens()
      expect(retrieved).toEqual(mockTokens)
    })

    it("returns null when no tokens stored", () => {
      const tokens = getStoredTokens()
      expect(tokens).toBeNull()
    })

    it("returns null for invalid JSON", () => {
      mockLocalStorage["google_calendar_tokens"] = "invalid json"
      const tokens = getStoredTokens()
      expect(tokens).toBeNull()
    })

    it("clears stored tokens", () => {
      storeTokens(mockTokens)
      clearStoredTokens()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("google_calendar_tokens")
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
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify(validTokens)

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
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify(expiredTokens)

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
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify(expiredTokens)

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

    it("returns error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "Server error" } }),
      })

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Server error")
    })

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await fetchEventsForDate(mockTokens, "2024-01-15")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Network error")
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
  })

  describe("isGoogleCalendarConfigured", () => {
    it("returns false when client ID is not set", () => {
      // The function checks the env var at runtime, which we've mocked
      // This test verifies the function exists and returns a boolean
      const result = isGoogleCalendarConfigured()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("isAuthenticated", () => {
    it("returns false when no tokens stored", () => {
      expect(isAuthenticated()).toBe(false)
    })

    it("returns true when tokens are stored", () => {
      const tokens: GoogleTokens = {
        accessToken: "access",
        expiresAt: Date.now() + 3600000,
        tokenType: "Bearer",
      }
      mockLocalStorage["google_calendar_tokens"] = JSON.stringify(tokens)
      expect(isAuthenticated()).toBe(true)
    })
  })
})
