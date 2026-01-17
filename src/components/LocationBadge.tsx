import type { GeoPosition } from "../hooks/useGeolocation"
import { useReverseGeocode } from "../hooks/useReverseGeocode"
import { LocationIcon } from "./Icons"
import { cn } from "@/lib/utils"

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
      <span className="text-sm">{displayText}</span>
    </>
  )

  const className = "text-muted-foreground inline-flex items-center gap-1"

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(className, "hover:text-foreground cursor-pointer transition-colors")}
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
