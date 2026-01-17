import { useState, useEffect, useCallback, useRef } from "react"
import { reverseGeocode, getCachedResult, type GeocodingResult } from "@/lib/geocoding"

/**
 * Options for the useReverseGeocode hook
 */
export interface UseReverseGeocodeOptions {
  /** Latitude in decimal degrees */
  latitude: number | null
  /** Longitude in decimal degrees */
  longitude: number | null
  /** Whether to automatically fetch on mount/coordinate change */
  enabled?: boolean
}

/**
 * Return type for the useReverseGeocode hook
 */
export interface UseReverseGeocodeReturn {
  /** The locality name (e.g., "Tamariu", "Brooklyn") */
  locality: string | null
  /** Full display name from the geocoding result */
  displayName: string | null
  /** Whether a geocoding request is in progress */
  isLoading: boolean
  /** Error message if the last request failed */
  error: string | null
  /** Manually trigger a geocoding request */
  refetch: () => Promise<GeocodingResult | null>
}

/**
 * Custom hook for reverse geocoding coordinates to locality names.
 * Uses the OpenStreetMap Nominatim API via the geocoding library.
 * Results are cached to minimize API calls.
 *
 * @param options - Configuration options including coordinates and enabled state
 * @returns Object containing locality, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { locality, isLoading, error } = useReverseGeocode({
 *   latitude: 41.9178,
 *   longitude: 3.2014,
 * })
 *
 * if (isLoading) return <span>Loading...</span>
 * if (error) return <span>Error: {error}</span>
 * if (locality) return <span>{locality}</span> // "Tamariu"
 * ```
 */
export function useReverseGeocode(options: UseReverseGeocodeOptions): UseReverseGeocodeReturn {
  const { latitude, longitude, enabled = true } = options

  const [locality, setLocality] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to store the latest coordinates for the fetchLocality callback
  // This avoids recreating the callback on every coordinate change
  const coordsRef = useRef({ latitude, longitude })
  coordsRef.current = { latitude, longitude }

  const fetchLocality = useCallback(async (): Promise<GeocodingResult | null> => {
    const { latitude: lat, longitude: lng } = coordsRef.current
    if (lat === null || lng === null) {
      return null
    }

    // Check cache first to avoid unnecessary loading state
    const cachedResult = getCachedResult(lat, lng)
    if (cachedResult) {
      if (cachedResult.success) {
        setLocality(cachedResult.locality)
        setDisplayName(cachedResult.displayName)
        setError(null)
      } else {
        setLocality(null)
        setDisplayName(null)
        setError(cachedResult.error ?? "Failed to get locality")
      }
      return cachedResult
    }

    setIsLoading(true)
    setError(null)

    const result = await reverseGeocode(lat, lng)

    if (result.success) {
      setLocality(result.locality)
      setDisplayName(result.displayName)
      setError(null)
    } else {
      setLocality(null)
      setDisplayName(null)
      setError(result.error ?? "Failed to get locality")
    }

    setIsLoading(false)
    return result
  }, [])

  // Fetch locality when coordinates change and enabled
  useEffect(() => {
    if (!enabled || latitude === null || longitude === null) {
      return
    }

    // Inline the fetch logic to avoid dependency on fetchLocality callback
    const doFetch = async () => {
      // Check cache first to avoid unnecessary loading state
      const cachedResult = getCachedResult(latitude, longitude)
      if (cachedResult) {
        if (cachedResult.success) {
          setLocality(cachedResult.locality)
          setDisplayName(cachedResult.displayName)
          setError(null)
        } else {
          setLocality(null)
          setDisplayName(null)
          setError(cachedResult.error ?? "Failed to get locality")
        }
        return
      }

      setIsLoading(true)
      setError(null)

      const result = await reverseGeocode(latitude, longitude)

      if (result.success) {
        setLocality(result.locality)
        setDisplayName(result.displayName)
        setError(null)
      } else {
        setLocality(null)
        setDisplayName(null)
        setError(result.error ?? "Failed to get locality")
      }

      setIsLoading(false)
    }

    doFetch()
  }, [enabled, latitude, longitude])

  // Reset state when coordinates become null
  useEffect(() => {
    if (latitude === null || longitude === null) {
      setLocality(null)
      setDisplayName(null)
      setError(null)
      setIsLoading(false)
    }
  }, [latitude, longitude])

  return {
    locality,
    displayName,
    isLoading,
    error,
    refetch: fetchLocality,
  }
}
