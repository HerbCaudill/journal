/**
 * Reverse geocoding library using OpenStreetMap Nominatim API
 * Converts geographic coordinates to locality names (e.g., city, town, village)
 */

/**
 * Result from reverse geocoding lookup
 */
export interface GeocodingResult {
  /** The locality name (city, town, village, etc.) */
  locality: string
  /** Full display name from the API */
  displayName: string
  /** Whether the lookup was successful */
  success: boolean
  /** Error message if the lookup failed */
  error?: string
}

/**
 * Response structure from Nominatim reverse geocoding API
 */
interface NominatimResponse {
  display_name: string
  address: {
    // Neighborhood-level (most specific)
    neighbourhood?: string
    quarter?: string
    suburb?: string
    // Small settlements
    hamlet?: string
    village?: string
    // Larger settlements
    town?: string
    city?: string
    // Administrative divisions
    municipality?: string
    county?: string
    state?: string
    country?: string
  }
  error?: string
}

/**
 * Cache entry for storing geocoding results
 */
interface CacheEntry {
  result: GeocodingResult
  timestamp: number
}

// In-memory cache for geocoding results
const cache = new Map<string, CacheEntry>()

// Cache expiration time: 24 hours
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000

// Maximum cache size to prevent unbounded memory growth
const MAX_CACHE_SIZE = 100

// Nominatim API endpoint
const NOMINATIM_API = "https://nominatim.openstreetmap.org/reverse"

// Minimum time between API requests (Nominatim usage policy: max 1 request/second)
const MIN_REQUEST_INTERVAL_MS = 1000
let lastRequestTime = 0

/**
 * Generate a cache key from coordinates
 * Uses 4 decimal places (~11m precision) for cache keys
 */
function getCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`
}

/**
 * Check if a cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_EXPIRATION_MS
}

/**
 * Get cached result if available and valid
 */
export function getCachedResult(latitude: number, longitude: number): GeocodingResult | null {
  const key = getCacheKey(latitude, longitude)
  const entry = cache.get(key)

  if (entry && isCacheValid(entry)) {
    return entry.result
  }

  // Remove expired entry
  if (entry) {
    cache.delete(key)
  }

  return null
}

/**
 * Evict the oldest entry from the cache (LRU eviction)
 */
function evictOldestEntry(): void {
  let oldestKey: string | null = null
  let oldestTime = Infinity

  for (const [key, entry] of cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp
      oldestKey = key
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey)
  }
}

/**
 * Store a result in the cache
 * Implements LRU eviction when cache exceeds MAX_CACHE_SIZE
 */
function cacheResult(latitude: number, longitude: number, result: GeocodingResult): void {
  const key = getCacheKey(latitude, longitude)

  // Evict oldest entry if cache is at max size and this is a new key
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
    evictOldestEntry()
  }

  cache.set(key, {
    result,
    timestamp: Date.now(),
  })
}

/**
 * Respect Nominatim rate limiting by waiting if necessary
 */
async function respectRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest),
    )
  }

  lastRequestTime = Date.now()
}

/**
 * Extract the most specific locality name from Nominatim address
 * Prioritizes neighborhood-level places over larger administrative divisions
 */
function extractLocality(address: NominatimResponse["address"]): string {
  // Try to get the most specific locality, in order of preference
  // Start with neighborhood-level, then settlements, then administrative
  return (
    address.neighbourhood ||
    address.quarter ||
    address.suburb ||
    address.hamlet ||
    address.village ||
    address.town ||
    address.city ||
    address.municipality ||
    address.county ||
    address.state ||
    address.country ||
    "Unknown location"
  )
}

/**
 * Perform reverse geocoding to convert coordinates to a locality name
 *
 * Uses OpenStreetMap Nominatim API (free, no API key required).
 * Results are cached for 24 hours to reduce API calls.
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @returns Promise resolving to geocoding result with locality name
 *
 * @example
 * ```ts
 * const result = await reverseGeocode(41.8781, -87.6298)
 * if (result.success) {
 *   console.log(result.locality) // "Chicago"
 * }
 * ```
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodingResult> {
  // Validate coordinates
  if (latitude < -90 || latitude > 90) {
    return {
      locality: "",
      displayName: "",
      success: false,
      error: `Invalid latitude: ${latitude}. Must be between -90 and 90.`,
    }
  }

  if (longitude < -180 || longitude > 180) {
    return {
      locality: "",
      displayName: "",
      success: false,
      error: `Invalid longitude: ${longitude}. Must be between -180 and 180.`,
    }
  }

  // Check cache first
  const cachedResult = getCachedResult(latitude, longitude)
  if (cachedResult) {
    return cachedResult
  }

  try {
    // Respect rate limiting
    await respectRateLimit()

    const url = new URL(NOMINATIM_API)
    url.searchParams.set("lat", latitude.toString())
    url.searchParams.set("lon", longitude.toString())
    url.searchParams.set("format", "json")
    url.searchParams.set("addressdetails", "1")

    const response = await fetch(url.toString(), {
      headers: {
        // Required by Nominatim usage policy
        "User-Agent": "JournalApp/1.0",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorResult: GeocodingResult = {
        locality: "",
        displayName: "",
        success: false,
        error: `HTTP error: ${response.status}`,
      }
      return errorResult
    }

    const data: NominatimResponse = await response.json()

    if (data.error) {
      const errorResult: GeocodingResult = {
        locality: "",
        displayName: "",
        success: false,
        error: data.error,
      }
      return errorResult
    }

    const result: GeocodingResult = {
      locality: extractLocality(data.address),
      displayName: data.display_name,
      success: true,
    }

    // Cache the successful result
    cacheResult(latitude, longitude, result)

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    return {
      locality: "",
      displayName: "",
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Clear the geocoding cache
 * Useful for testing or when the cache needs to be refreshed
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Get the current cache size
 * Useful for debugging and monitoring
 */
export function getCacheSize(): number {
  return cache.size
}

/**
 * Reset the rate limiter's last request time
 * Useful for testing
 */
export function resetRateLimiter(): void {
  lastRequestTime = 0
}

/**
 * Get the maximum cache size
 * Useful for testing
 */
export function getMaxCacheSize(): number {
  return MAX_CACHE_SIZE
}
