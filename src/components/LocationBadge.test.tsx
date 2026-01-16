import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LocationBadge } from "./LocationBadge"
import type { GeoPosition } from "../hooks/useGeolocation"
import * as useReverseGeocodeModule from "../hooks/useReverseGeocode"

// Mock the useReverseGeocode hook
vi.mock("../hooks/useReverseGeocode", () => ({
  useReverseGeocode: vi.fn(),
}))

const mockUseReverseGeocode = vi.mocked(useReverseGeocodeModule.useReverseGeocode)

describe("LocationBadge", () => {
  const mockPosition: GeoPosition = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 100,
    timestamp: 1700000000000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: no locality loaded yet
    mockUseReverseGeocode.mockReturnValue({
      locality: null,
      displayName: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  describe("when locality is available from reverse geocoding", () => {
    beforeEach(() => {
      mockUseReverseGeocode.mockReturnValue({
        locality: "New York",
        displayName: "New York, NY, United States",
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
    })

    it("renders locality name as primary text", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(screen.getByText("New York")).toBeInTheDocument()
    })

    it("does not show coordinates in the visible text", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(screen.queryByText(/40\.7128° N/)).not.toBeInTheDocument()
    })

    it("shows full display name in title attribute", () => {
      render(<LocationBadge position={mockPosition} />)

      const badge = screen.getByLabelText(/Location: New York/)
      expect(badge).toHaveAttribute("title", "New York, NY, United States")
    })

    it("has accessible aria-label with locality and coordinates", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(
        screen.getByLabelText(/Location: New York \(40\.7128° N, 74\.0060° W\)/),
      ).toBeInTheDocument()
    })
  })

  describe("when locality is stored in position", () => {
    it("uses stored locality and disables fetching", () => {
      const positionWithLocality: GeoPosition = {
        ...mockPosition,
        locality: "Brooklyn",
      }

      render(<LocationBadge position={positionWithLocality} />)

      // Should display the stored locality
      expect(screen.getByText("Brooklyn")).toBeInTheDocument()

      // Should call useReverseGeocode with enabled: false
      expect(mockUseReverseGeocode).toHaveBeenCalledWith({
        latitude: positionWithLocality.latitude,
        longitude: positionWithLocality.longitude,
        enabled: false,
      })
    })
  })

  describe("when loading locality", () => {
    beforeEach(() => {
      mockUseReverseGeocode.mockReturnValue({
        locality: null,
        displayName: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })
    })

    it("shows loading state", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })
  })

  describe("when locality is not available (fallback to coordinates)", () => {
    it("renders latitude and longitude", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(screen.getByText(/40\.7128° N, 74\.0060° W/)).toBeInTheDocument()
    })

    it("has accessible aria-label with coordinates", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(screen.getByLabelText(/Location: 40\.7128° N, 74\.0060° W/)).toBeInTheDocument()
    })

    it("handles southern latitude correctly", () => {
      const southernPosition: GeoPosition = {
        latitude: -33.8688,
        longitude: 151.2093,
        timestamp: 1700000000000,
      }

      render(<LocationBadge position={southernPosition} />)

      expect(screen.getByText(/33\.8688° S, 151\.2093° E/)).toBeInTheDocument()
    })

    it("handles eastern longitude correctly", () => {
      const easternPosition: GeoPosition = {
        latitude: 51.5074,
        longitude: 0.1278,
        timestamp: 1700000000000,
      }

      render(<LocationBadge position={easternPosition} />)

      expect(screen.getByText(/51\.5074° N, 0\.1278° E/)).toBeInTheDocument()
    })
  })

  describe("click handling", () => {
    it("calls onClick when provided and clicked", () => {
      const handleClick = vi.fn()

      render(<LocationBadge position={mockPosition} onClick={handleClick} />)

      const button = screen.getByRole("button")
      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("renders as a span when no onClick is provided", () => {
      render(<LocationBadge position={mockPosition} />)

      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })

    it("renders as a button when onClick is provided", () => {
      render(<LocationBadge position={mockPosition} onClick={() => {}} />)

      expect(screen.getByRole("button")).toBeInTheDocument()
    })
  })
})
