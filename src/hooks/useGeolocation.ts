import { useState, useCallback, useEffect } from "react"

/**
 * Geographic coordinates with optional accuracy
 */
export interface GeoPosition {
  /** Latitude in decimal degrees */
  latitude: number
  /** Longitude in decimal degrees */
  longitude: number
  /** Accuracy of the position in meters (optional) */
  accuracy?: number
  /** Timestamp when the position was captured */
  timestamp: number
  /** Human-readable locality name (e.g. 'Tamariu', 'Brooklyn') */
  locality?: string
}

/**
 * Permission state for geolocation
 */
export type GeolocationPermission = "prompt" | "granted" | "denied" | "unavailable"

/**
 * Options for the useGeolocation hook
 */
export interface UseGeolocationOptions {
  /** Whether to enable high accuracy mode (uses more battery) */
  enableHighAccuracy?: boolean
  /** Maximum age of cached position in milliseconds */
  maximumAge?: number
  /** Timeout for position request in milliseconds */
  timeout?: number
  /** Whether to automatically request position on mount */
  autoRequest?: boolean
}

/**
 * Return type for the useGeolocation hook
 */
export interface UseGeolocationReturn {
  /** Current position (null if not yet obtained) */
  position: GeoPosition | null
  /** Whether a position request is in progress */
  isLoading: boolean
  /** Error message if the last request failed */
  error: string | null
  /** Current permission state */
  permission: GeolocationPermission
  /** Request the current position */
  requestPosition: () => Promise<GeoPosition | null>
  /** Clear the current position and error */
  clear: () => void
}

/**
 * Map GeolocationPositionError codes to user-friendly messages
 */
function getErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied"
    case error.POSITION_UNAVAILABLE:
      return "Location information unavailable"
    case error.TIMEOUT:
      return "Location request timed out"
    default:
      return "Failed to get location"
  }
}

/**
 * Custom hook for accessing device geolocation.
 * Handles permission management, position requests, and error states.
 *
 * @param options - Configuration options for geolocation behavior
 * @returns Object containing position, loading state, error, permission, and control functions
 *
 * @example
 * ```tsx
 * const { position, isLoading, error, permission, requestPosition } = useGeolocation({
 *   enableHighAccuracy: true,
 * })
 *
 * // Request position manually
 * const pos = await requestPosition()
 * if (pos) {
 *   console.log(`Lat: ${pos.latitude}, Lng: ${pos.longitude}`)
 * }
 * ```
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const {
    enableHighAccuracy = false,
    maximumAge = 0,
    timeout = 10000,
    autoRequest = false,
  } = options

  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<GeolocationPermission>("prompt")

  // Check if geolocation is available
  const isSupported = typeof navigator !== "undefined" && "geolocation" in navigator

  // Check permission status on mount
  useEffect(() => {
    if (!isSupported) {
      setPermission("unavailable")
      return
    }

    // Track the permission status result and handler for cleanup
    let permissionStatus: PermissionStatus | null = null
    const handleChange = () => {
      if (permissionStatus) {
        setPermission(permissionStatus.state as GeolocationPermission)
      }
    }

    // Check permission status if the Permissions API is available
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then(result => {
          permissionStatus = result
          setPermission(result.state as GeolocationPermission)

          // Listen for permission changes
          result.addEventListener("change", handleChange)
        })
        .catch(() => {
          // Permissions API not fully supported, stay with "prompt"
        })
    }

    // Cleanup: remove event listener when unmounting
    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener("change", handleChange)
      }
    }
  }, [isSupported])

  const requestPosition = useCallback(async (): Promise<GeoPosition | null> => {
    // Check support at call time (navigator.geolocation might not exist or be undefined)
    const geolocationSupported =
      typeof navigator !== "undefined" && navigator.geolocation !== undefined

    if (!geolocationSupported) {
      setError("Geolocation is not supported by this browser")
      setPermission("unavailable")
      return null
    }

    setIsLoading(true)
    setError(null)

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        geoPosition => {
          const pos: GeoPosition = {
            latitude: geoPosition.coords.latitude,
            longitude: geoPosition.coords.longitude,
            accuracy: geoPosition.coords.accuracy,
            timestamp: geoPosition.timestamp,
          }
          setPosition(pos)
          setPermission("granted")
          setIsLoading(false)
          resolve(pos)
        },
        geoError => {
          const errorMessage = getErrorMessage(geoError)
          setError(errorMessage)
          setIsLoading(false)

          if (geoError.code === geoError.PERMISSION_DENIED) {
            setPermission("denied")
          }

          resolve(null)
        },
        {
          enableHighAccuracy,
          maximumAge,
          timeout,
        },
      )
    })
  }, [isSupported, enableHighAccuracy, maximumAge, timeout])

  // Auto-request position on mount if enabled
  useEffect(() => {
    if (autoRequest && isSupported) {
      requestPosition()
    }
  }, [autoRequest, isSupported, requestPosition])

  const clear = useCallback(() => {
    setPosition(null)
    setError(null)
  }, [])

  return {
    position,
    isLoading,
    error,
    permission,
    requestPosition,
    clear,
  }
}
