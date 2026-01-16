import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useReverseGeocode } from "./useReverseGeocode"
import * as geocoding from "@/lib/geocoding"

// Mock the geocoding module
vi.mock("@/lib/geocoding", () => ({
  reverseGeocode: vi.fn(),
  getCachedResult: vi.fn(),
}))

describe("useReverseGeocode", () => {
  const mockReverseGeocode = vi.mocked(geocoding.reverseGeocode)
  const mockGetCachedResult = vi.mocked(geocoding.getCachedResult)

  const successResult: geocoding.GeocodingResult = {
    locality: "Tamariu",
    displayName: "Tamariu, Palafrugell, Catalonia, Spain",
    success: true,
  }

  const errorResult: geocoding.GeocodingResult = {
    locality: "",
    displayName: "",
    success: false,
    error: "Network error",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCachedResult.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("initialization", () => {
    it("initializes with null values when no coordinates provided", () => {
      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: null,
          longitude: null,
        }),
      )

      expect(result.current.locality).toBeNull()
      expect(result.current.displayName).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it("does not fetch when coordinates are null", () => {
      renderHook(() =>
        useReverseGeocode({
          latitude: null,
          longitude: null,
        }),
      )

      expect(mockReverseGeocode).not.toHaveBeenCalled()
    })

    it("does not fetch when disabled", () => {
      renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
          enabled: false,
        }),
      )

      expect(mockReverseGeocode).not.toHaveBeenCalled()
    })
  })

  describe("fetching", () => {
    it("fetches locality when coordinates are provided", async () => {
      mockReverseGeocode.mockResolvedValueOnce(successResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      expect(result.current.displayName).toBe("Tamariu, Palafrugell, Catalonia, Spain")
      expect(result.current.error).toBeNull()
    })

    it("shows loading state while fetching", async () => {
      let resolvePromise: (value: geocoding.GeocodingResult) => void
      mockReverseGeocode.mockReturnValueOnce(
        new Promise(resolve => {
          resolvePromise = resolve
        }),
      )

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      // Should be loading
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!(successResult)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("handles errors gracefully", async () => {
      mockReverseGeocode.mockResolvedValueOnce(errorResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.error).toBe("Network error")
      })

      expect(result.current.locality).toBeNull()
      expect(result.current.displayName).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it("uses default error message when error is undefined", async () => {
      mockReverseGeocode.mockResolvedValueOnce({
        locality: "",
        displayName: "",
        success: false,
      })

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to get locality")
      })
    })
  })

  describe("caching", () => {
    it("uses cached result when available", async () => {
      mockGetCachedResult.mockReturnValueOnce(successResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      // Should not call reverseGeocode when cache hit
      expect(mockReverseGeocode).not.toHaveBeenCalled()
    })

    it("handles cached error result", async () => {
      mockGetCachedResult.mockReturnValueOnce(errorResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.error).toBe("Network error")
      })

      expect(result.current.locality).toBeNull()
      expect(mockReverseGeocode).not.toHaveBeenCalled()
    })

    it("does not show loading state for cached results", async () => {
      mockGetCachedResult.mockReturnValueOnce(successResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      // Should never show loading state for cached results
      expect(result.current.isLoading).toBe(false)

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })
    })
  })

  describe("coordinate changes", () => {
    it("refetches when coordinates change", async () => {
      mockReverseGeocode.mockResolvedValue(successResult)

      const { result, rerender } = renderHook(
        ({ lat, lng }) =>
          useReverseGeocode({
            latitude: lat,
            longitude: lng,
          }),
        { initialProps: { lat: 41.9178, lng: 3.2014 } },
      )

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      expect(mockReverseGeocode).toHaveBeenCalledTimes(1)

      // Change coordinates
      const newResult: geocoding.GeocodingResult = {
        locality: "Barcelona",
        displayName: "Barcelona, Catalonia, Spain",
        success: true,
      }
      mockReverseGeocode.mockResolvedValueOnce(newResult)

      rerender({ lat: 41.3851, lng: 2.1734 })

      await waitFor(() => {
        expect(result.current.locality).toBe("Barcelona")
      })

      expect(mockReverseGeocode).toHaveBeenCalledTimes(2)
    })

    it("resets state when coordinates become null", async () => {
      mockReverseGeocode.mockResolvedValueOnce(successResult)

      const { result, rerender } = renderHook(
        ({ lat, lng }) =>
          useReverseGeocode({
            latitude: lat,
            longitude: lng,
          }),
        { initialProps: { lat: 41.9178 as number | null, lng: 3.2014 as number | null } },
      )

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      // Set coordinates to null
      rerender({ lat: null, lng: null })

      await waitFor(() => {
        expect(result.current.locality).toBeNull()
      })

      expect(result.current.displayName).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe("enabled toggle", () => {
    it("fetches when enabled becomes true", async () => {
      mockReverseGeocode.mockResolvedValueOnce(successResult)

      const { result, rerender } = renderHook(
        ({ enabled }) =>
          useReverseGeocode({
            latitude: 41.9178,
            longitude: 3.2014,
            enabled,
          }),
        { initialProps: { enabled: false } },
      )

      expect(mockReverseGeocode).not.toHaveBeenCalled()

      rerender({ enabled: true })

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      expect(mockReverseGeocode).toHaveBeenCalledTimes(1)
    })
  })

  describe("refetch", () => {
    it("allows manual refetching", async () => {
      mockReverseGeocode.mockResolvedValue(successResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      expect(mockReverseGeocode).toHaveBeenCalledTimes(1)

      // Manual refetch
      const newResult: geocoding.GeocodingResult = {
        locality: "Tamariu Updated",
        displayName: "Tamariu, Updated",
        success: true,
      }
      mockReverseGeocode.mockResolvedValueOnce(newResult)
      mockGetCachedResult.mockReturnValueOnce(null) // Cache miss

      await act(async () => {
        await result.current.refetch()
      })

      expect(mockReverseGeocode).toHaveBeenCalledTimes(2)
    })

    it("returns null from refetch when coordinates are null", async () => {
      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: null,
          longitude: null,
        }),
      )

      let refetchResult: geocoding.GeocodingResult | null =
        undefined as unknown as geocoding.GeocodingResult | null
      await act(async () => {
        refetchResult = await result.current.refetch()
      })

      expect(refetchResult).toBeNull()
      expect(mockReverseGeocode).not.toHaveBeenCalled()
    })

    it("refetch uses cache when available", async () => {
      mockReverseGeocode.mockResolvedValueOnce(successResult)

      const { result } = renderHook(() =>
        useReverseGeocode({
          latitude: 41.9178,
          longitude: 3.2014,
        }),
      )

      await waitFor(() => {
        expect(result.current.locality).toBe("Tamariu")
      })

      // Set up cache hit for refetch
      mockGetCachedResult.mockReturnValueOnce(successResult)

      await act(async () => {
        await result.current.refetch()
      })

      // Should not call reverseGeocode again due to cache
      expect(mockReverseGeocode).toHaveBeenCalledTimes(1)
    })
  })
})
