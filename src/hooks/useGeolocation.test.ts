import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useGeolocation, type GeoPosition } from "./useGeolocation"

// Mock the geolocation API
const mockGetCurrentPosition = vi.fn()
const mockQuery = vi.fn()

const mockGeolocation = {
  getCurrentPosition: mockGetCurrentPosition,
}

const mockPermissions = {
  query: mockQuery,
}

describe("useGeolocation", () => {
  const mockCoords = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 100,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  }

  const mockPosition = {
    coords: mockCoords,
    timestamp: 1700000000000,
    toJSON: () => ({}),
  } as GeolocationPosition

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup navigator mocks
    Object.defineProperty(navigator, "geolocation", {
      value: mockGeolocation,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, "permissions", {
      value: mockPermissions,
      configurable: true,
      writable: true,
    })

    // Default mock for permissions query
    mockQuery.mockResolvedValue({
      state: "prompt",
      addEventListener: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("initializes with default state", () => {
    const { result } = renderHook(() => useGeolocation())

    expect(result.current.position).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("requests position and updates state on success", async () => {
    mockGetCurrentPosition.mockImplementation(success => {
      success(mockPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    let returnedPosition: GeoPosition | null = null
    await act(async () => {
      returnedPosition = await result.current.requestPosition()
    })

    expect(result.current.position).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 100,
      timestamp: 1700000000000,
    })
    expect(returnedPosition).toEqual(result.current.position)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("sets isLoading to true while requesting", async () => {
    let resolvePosition: (pos: GeolocationPosition) => void
    mockGetCurrentPosition.mockImplementation(success => {
      resolvePosition = success
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.requestPosition()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolvePosition!(mockPosition)
    })

    expect(result.current.isLoading).toBe(false)
  })

  it("handles permission denied error", async () => {
    const permissionError = {
      code: 1, // PERMISSION_DENIED
      message: "User denied Geolocation",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError

    mockGetCurrentPosition.mockImplementation((_, error) => {
      error(permissionError)
    })

    const { result } = renderHook(() => useGeolocation())

    let returnedPosition: GeoPosition | null
    await act(async () => {
      returnedPosition = await result.current.requestPosition()
    })

    expect(returnedPosition!).toBeNull()
    expect(result.current.position).toBeNull()
    expect(result.current.error).toBe("Location permission denied")
  })

  it("handles position unavailable error", async () => {
    const unavailableError = {
      code: 2, // POSITION_UNAVAILABLE
      message: "Position unavailable",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError

    mockGetCurrentPosition.mockImplementation((_, error) => {
      error(unavailableError)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestPosition()
    })

    expect(result.current.error).toBe("Location information unavailable")
  })

  it("handles timeout error", async () => {
    const timeoutError = {
      code: 3, // TIMEOUT
      message: "Timeout",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError

    mockGetCurrentPosition.mockImplementation((_, error) => {
      error(timeoutError)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestPosition()
    })

    expect(result.current.error).toBe("Location request timed out")
  })

  it("passes options to getCurrentPosition", async () => {
    mockGetCurrentPosition.mockImplementation(success => {
      success(mockPosition)
    })

    const { result } = renderHook(() =>
      useGeolocation({
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }),
    )

    await act(async () => {
      await result.current.requestPosition()
    })

    expect(mockGetCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    )
  })

  it("clears position and error", async () => {
    mockGetCurrentPosition.mockImplementation(success => {
      success(mockPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestPosition()
    })

    expect(result.current.position).not.toBeNull()

    act(() => {
      result.current.clear()
    })

    expect(result.current.position).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("auto-requests position on mount when enabled", async () => {
    mockGetCurrentPosition.mockImplementation(success => {
      success(mockPosition)
    })

    const { result } = renderHook(() => useGeolocation({ autoRequest: true }))

    await waitFor(() => {
      expect(result.current.position).not.toBeNull()
    })

    expect(mockGetCurrentPosition).toHaveBeenCalled()
  })

  it("does not auto-request when disabled", () => {
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))

    expect(result.current.position).toBeNull()
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })

  it("handles unsupported geolocation", async () => {
    // Remove geolocation from navigator
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useGeolocation())

    let returnedPosition: GeoPosition | null
    await act(async () => {
      returnedPosition = await result.current.requestPosition()
    })

    expect(returnedPosition!).toBeNull()
    expect(result.current.error).toBe("Geolocation is not supported by this browser")
  })

  it("checks permission status on mount", async () => {
    mockQuery.mockResolvedValue({
      state: "granted",
      addEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useGeolocation())

    await waitFor(() => {
      expect(result.current.permission).toBe("granted")
    })

    expect(mockQuery).toHaveBeenCalledWith({ name: "geolocation" })
  })

  it("listens for permission changes", async () => {
    let permissionChangeHandler: (() => void) | null = null
    const mockPermissionStatus = {
      state: "prompt" as PermissionState,
      addEventListener: vi.fn((_, handler) => {
        permissionChangeHandler = handler
      }),
    }
    mockQuery.mockResolvedValue(mockPermissionStatus)

    const { result } = renderHook(() => useGeolocation())

    await waitFor(() => {
      expect(mockPermissionStatus.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      )
    })

    // Simulate permission change
    mockPermissionStatus.state = "granted"
    act(() => {
      permissionChangeHandler?.()
    })

    expect(result.current.permission).toBe("granted")
  })

  it("supports optional locality field in GeoPosition interface", () => {
    // Test that the GeoPosition interface accepts locality
    const positionWithLocality: GeoPosition = {
      latitude: 41.8914,
      longitude: 3.2079,
      accuracy: 50,
      timestamp: 1700000000000,
      locality: "Tamariu",
    }

    expect(positionWithLocality.locality).toBe("Tamariu")

    // Position without locality should also be valid
    const positionWithoutLocality: GeoPosition = {
      latitude: 40.7128,
      longitude: -74.006,
      timestamp: 1700000000000,
    }

    expect(positionWithoutLocality.locality).toBeUndefined()
  })
})
