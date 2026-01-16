import type { GeoPosition } from "../hooks/useGeolocation"
import { useReverseGeocode } from "../hooks/useReverseGeocode"

interface LocationBadgeProps {
  /** The geographic position to display */
  position: GeoPosition
  /** Optional click handler for additional interactions */
  onClick?: () => void
}

/**
 * Formats coordinates for display.
 * Shows 4 decimal places which gives ~11m precision.
 */
function formatCoordinate(value: number, isLatitude: boolean): string {
  const direction =
    isLatitude ?
      value >= 0 ?
        "N"
      : "S"
    : value >= 0 ? "E"
    : "W"
  return `${Math.abs(value).toFixed(4)}° ${direction}`
}

/**
 * A compact badge component that displays captured location.
 * Shows locality name (e.g., "Tamariu") when available, with coordinates on hover.
 * Falls back to coordinates if locality cannot be determined.
 */
export function LocationBadge({ position, onClick }: LocationBadgeProps) {
  const { latitude, longitude, locality: storedLocality } = position

  // Use reverse geocoding to fetch locality if not already stored in position
  const {
    locality: fetchedLocality,
    displayName,
    isLoading,
  } = useReverseGeocode({
    latitude,
    longitude,
    // Skip fetching if locality is already stored in the position
    enabled: !storedLocality,
  })

  // Use stored locality first, then fetched locality
  const locality = storedLocality ?? fetchedLocality

  const formattedLat = formatCoordinate(latitude, true)
  const formattedLng = formatCoordinate(longitude, false)
  const coordinates = `${formattedLat}, ${formattedLng}`

  // Determine what to display
  const displayText = isLoading ? "Loading..." : (locality ?? coordinates)

  // Tooltip shows full details: displayName if available, otherwise coordinates
  const tooltipText = displayName ?? coordinates

  // Aria label includes both locality (if available) and coordinates
  const ariaLabel = locality ? `Location: ${locality} (${coordinates})` : `Location: ${coordinates}`

  const content = (
    <>
      <LocationIcon />
      <span className="text-xs">{displayText}</span>
    </>
  )

  const className =
    "inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-full text-foreground"

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${className} hover:bg-muted/80 cursor-pointer transition-colors`}
        aria-label={ariaLabel}
        title={tooltipText}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} aria-label={ariaLabel} title={tooltipText}>
      {content}
    </span>
  )
}

function LocationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
