import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  reverseGeocode,
  getCachedResult,
  clearCache,
  getCacheSize,
  resetRateLimiter,
} from "./geocoding"

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("geocoding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCache()
    resetRateLimiter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("reverseGeocode", () => {
    const mockSuccessResponse = {
      display_name: "Tamariu, Palafrugell, Baix Empordà, Girona, Catalonia, Spain",
      address: {
        village: "Tamariu",
        municipality: "Palafrugell",
        county: "Baix Empordà",
        state: "Catalonia",
        country: "Spain",
      },
    }

    it("returns locality name on successful lookup", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      })

      const result = await reverseGeocode(41.9178, 3.2014)

      expect(result.success).toBe(true)
      expect(result.locality).toBe("Tamariu")
      expect(result.displayName).toBe(
        "Tamariu, Palafrugell, Baix Empordà, Girona, Catalonia, Spain",
      )
      expect(result.error).toBeUndefined()
    })

    it("calls Nominatim API with correct parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      })

      await reverseGeocode(41.9178, 3.2014)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("nominatim.openstreetmap.org/reverse"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "JournalApp/1.0",
            Accept: "application/json",
          }),
        }),
      )

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain("lat=41.9178")
      expect(calledUrl).toContain("lon=3.2014")
      expect(calledUrl).toContain("format=json")
      expect(calledUrl).toContain("addressdetails=1")
    })

    it("returns error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await reverseGeocode(41.9178, 3.2014)

      expect(result.success).toBe(false)
      expect(result.error).toBe("HTTP error: 500")
      expect(result.locality).toBe("")
    })

    it("returns error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await reverseGeocode(41.9178, 3.2014)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Network error")
      expect(result.locality).toBe("")
    })

    it("returns error when API returns error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "Unable to geocode" }),
      })

      const result = await reverseGeocode(0, 0)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Unable to geocode")
    })

    it("extracts city when village is not available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          display_name: "Chicago, Cook County, Illinois, USA",
          address: {
            city: "Chicago",
            county: "Cook County",
            state: "Illinois",
            country: "USA",
          },
        }),
      })

      const result = await reverseGeocode(41.8781, -87.6298)

      expect(result.locality).toBe("Chicago")
    })

    it("extracts town when village and city are not available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          display_name: "Kennebunkport, York County, Maine, USA",
          address: {
            town: "Kennebunkport",
            county: "York County",
            state: "Maine",
            country: "USA",
          },
        }),
      })

      const result = await reverseGeocode(43.3617, -70.4764)

      expect(result.locality).toBe("Kennebunkport")
    })

    it("falls back to country when no specific locality", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          display_name: "Antarctica",
          address: {
            country: "Antarctica",
          },
        }),
      })

      const result = await reverseGeocode(-90, 0)

      expect(result.locality).toBe("Antarctica")
    })

    it("returns unknown location when no address data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          display_name: "Unknown",
          address: {},
        }),
      })

      const result = await reverseGeocode(0, 0)

      expect(result.locality).toBe("Unknown location")
    })

    it("handles non-Error exceptions", async () => {
      mockFetch.mockRejectedValueOnce("string error")

      const result = await reverseGeocode(41.9178, 3.2014)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Unknown error occurred")
    })
  })

  describe("caching", () => {
    const mockResponse = {
      display_name: "Barcelona, Catalonia, Spain",
      address: {
        city: "Barcelona",
        state: "Catalonia",
        country: "Spain",
      },
    }

    it("caches successful results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      // First call - should hit API
      await reverseGeocode(41.3851, 2.1734)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Reset rate limiter for next call
      resetRateLimiter()

      // Second call with same coordinates - should use cache
      const result = await reverseGeocode(41.3851, 2.1734)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Still just 1
      expect(result.locality).toBe("Barcelona")
    })

    it("uses rounded coordinates for cache key (4 decimal places)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      // First call - 41.38512345 rounds to 41.3851
      await reverseGeocode(41.38512345, 2.17342345)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Reset rate limiter for next call
      resetRateLimiter()

      // Second call with slightly different coordinates that round to same 4 decimals
      // 41.38514999 also rounds to 41.3851
      const result = await reverseGeocode(41.38514999, 2.17344999)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Cache hit
      expect(result.locality).toBe("Barcelona")
    })

    it("does not cache failed results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await reverseGeocode(41.3851, 2.1734)
      expect(getCacheSize()).toBe(0)
    })

    it("returns null from getCachedResult when no cache entry", () => {
      const result = getCachedResult(41.3851, 2.1734)
      expect(result).toBeNull()
    })

    it("returns cached result from getCachedResult when available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await reverseGeocode(41.3851, 2.1734)

      const cachedResult = getCachedResult(41.3851, 2.1734)
      expect(cachedResult).not.toBeNull()
      expect(cachedResult?.locality).toBe("Barcelona")
    })

    it("expires cache after 24 hours", async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      // First call
      await reverseGeocode(41.3851, 2.1734)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Advance time past cache expiration (24 hours + 1 second)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000)

      // Reset rate limiter
      resetRateLimiter()

      // Second call - cache should be expired
      await reverseGeocode(41.3851, 2.1734)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("clearCache removes all cached entries", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      await reverseGeocode(41.3851, 2.1734)
      expect(getCacheSize()).toBe(1)

      clearCache()
      expect(getCacheSize()).toBe(0)
    })
  })

  describe("rate limiting", () => {
    const mockResponse = {
      display_name: "Location",
      address: { city: "City" },
    }

    it("respects 1 second minimum between requests", async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      // Start first request (use different coordinates to avoid cache)
      const promise1 = reverseGeocode(41.0, 2.0)

      // Advance timers to complete first request
      await vi.runAllTimersAsync()
      await promise1

      // Start second request immediately after (different coordinates)
      const promise2Started = reverseGeocode(42.0, 3.0)

      // Advance timers to complete rate limit wait and second request
      await vi.runAllTimersAsync()
      await promise2Started

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
