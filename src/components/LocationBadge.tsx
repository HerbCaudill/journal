import type { GeoPosition } from "../hooks/useGeolocation"

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
  const direction = isLatitude
    ? value >= 0 ? "N" : "S"
    : value >= 0 ? "E" : "W"
  return `${Math.abs(value).toFixed(4)}° ${direction}`
}

/**
 * Formats accuracy in a human-readable way
 */
function formatAccuracy(accuracy: number): string {
  if (accuracy < 1000) {
    return `±${Math.round(accuracy)}m`
  }
  return `±${(accuracy / 1000).toFixed(1)}km`
}

/**
 * A compact badge component that displays captured location coordinates.
 * Shows latitude, longitude, and optionally accuracy.
 */
export function LocationBadge({ position, onClick }: LocationBadgeProps) {
  const { latitude, longitude, accuracy } = position

  const formattedLat = formatCoordinate(latitude, true)
  const formattedLng = formatCoordinate(longitude, false)

  const content = (
    <>
      <LocationIcon />
      <span className="text-xs">
        {formattedLat}, {formattedLng}
        {accuracy !== undefined && (
          <span className="text-muted-foreground ml-1">
            ({formatAccuracy(accuracy)})
          </span>
        )}
      </span>
    </>
  )

  const className =
    "inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-full text-foreground"

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${className} hover:bg-muted/80 transition-colors cursor-pointer`}
        aria-label={`Location: ${formattedLat}, ${formattedLng}`}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} aria-label={`Location: ${formattedLat}, ${formattedLng}`}>
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
