/**
 * Centralized icon components using Tabler Icons.
 * All icons in the application should be imported from this file.
 *
 * @see https://tabler.io/icons
 */
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowUp,
  IconBrandGoogle,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceDesktop,
  IconExclamationCircle,
  IconExternalLink,
  IconLoader2,
  IconMapPin,
  IconMoon,
  IconSettings,
  IconSun,
  IconX,
} from "@tabler/icons-react"

// Re-export commonly used icons with consistent sizing and styling

// Navigation icons
export function ChevronLeftIcon({ size = 20 }: { size?: number }) {
  return <IconChevronLeft size={size} stroke={2} />
}

export function ChevronRightIcon({ size = 20 }: { size?: number }) {
  return <IconChevronRight size={size} stroke={2} />
}

export function BackIcon({ size = 24 }: { size?: number }) {
  return <IconArrowLeft size={size} stroke={2} />
}

// Calendar icons
export function CalendarIcon({
  size = 16,
  "aria-label": ariaLabel,
}: {
  size?: number
  "aria-label"?: string
}) {
  return <IconCalendar size={size} stroke={2} aria-label={ariaLabel} aria-hidden={!ariaLabel} />
}

// Settings icon
export function SettingsIcon({ size = 20 }: { size?: number }) {
  return <IconSettings size={size} stroke={2} />
}

// Status icons
export function CheckIcon({ size = 16 }: { size?: number }) {
  return <IconCheck size={size} stroke={2} />
}

export function ErrorIcon({ size = 16 }: { size?: number }) {
  return <IconExclamationCircle size={size} stroke={2} />
}

export function AlertTriangleIcon({ size = 64, className }: { size?: number; className?: string }) {
  return <IconAlertTriangle size={size} stroke={2} className={className} />
}

export function WarningIcon({ size = 20, className }: { size?: number; className?: string }) {
  return <IconAlertTriangle size={size} stroke={2} className={className} />
}

// External link icon
export function ExternalLinkIcon({ size = 14 }: { size?: number }) {
  return <IconExternalLink size={size} stroke={2} aria-hidden="true" />
}

// Close/dismiss icon
export function XIcon({ size = 14 }: { size?: number }) {
  return <IconX size={size} stroke={2} aria-hidden="true" />
}

// Location icon
export function LocationIcon({ size = 12 }: { size?: number }) {
  return <IconMapPin size={size} stroke={2} aria-hidden="true" />
}

// Theme icons
export function SunIcon({ size = 18 }: { size?: number }) {
  return <IconSun size={size} stroke={2} />
}

export function MoonIcon({ size = 18 }: { size?: number }) {
  return <IconMoon size={size} stroke={2} />
}

export function MonitorIcon({ size = 18 }: { size?: number }) {
  return <IconDeviceDesktop size={size} stroke={2} />
}

// Brand icons
// Note: Google icon uses the official Google brand colors
export function GoogleIcon({ size = 20 }: { size?: number }) {
  return <IconBrandGoogle size={size} stroke={2} />
}

// Loading/submit icons
export function LoadingSpinner({ size = 12 }: { size?: number }) {
  return <IconLoader2 size={size} stroke={2} className="animate-spin" />
}

export function ArrowUpIcon({ size = 12 }: { size?: number }) {
  return <IconArrowUp size={size} stroke={2.5} />
}

/**
 * Renders the submit button icon based on loading state
 */
export function SubmitButtonIcon({ isLoading, size = 12 }: { isLoading: boolean; size?: number }) {
  if (isLoading) {
    return <LoadingSpinner size={size} />
  }
  return <ArrowUpIcon size={size} />
}
