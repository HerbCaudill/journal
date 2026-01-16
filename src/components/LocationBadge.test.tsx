import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LocationBadge } from "./LocationBadge"
import type { GeoPosition } from "../hooks/useGeolocation"

describe("LocationBadge", () => {
  const mockPosition: GeoPosition = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 100,
    timestamp: 1700000000000,
  }

  it("renders latitude and longitude", () => {
    render(<LocationBadge position={mockPosition} />)

    expect(screen.getByText(/40\.7128° N/)).toBeInTheDocument()
    expect(screen.getByText(/74\.0060° W/)).toBeInTheDocument()
  })

  it("renders accuracy when provided", () => {
    render(<LocationBadge position={mockPosition} />)

    expect(screen.getByText(/±100m/)).toBeInTheDocument()
  })

  it("formats accuracy in kilometers for large values", () => {
    const positionWithLargeAccuracy: GeoPosition = {
      ...mockPosition,
      accuracy: 2500,
    }

    render(<LocationBadge position={positionWithLargeAccuracy} />)

    expect(screen.getByText(/±2\.5km/)).toBeInTheDocument()
  })

  it("does not show accuracy when undefined", () => {
    const positionWithoutAccuracy: GeoPosition = {
      latitude: 40.7128,
      longitude: -74.006,
      timestamp: 1700000000000,
    }

    render(<LocationBadge position={positionWithoutAccuracy} />)

    expect(screen.queryByText(/±/)).not.toBeInTheDocument()
  })

  it("handles southern latitude correctly", () => {
    const southernPosition: GeoPosition = {
      latitude: -33.8688,
      longitude: 151.2093,
      timestamp: 1700000000000,
    }

    render(<LocationBadge position={southernPosition} />)

    expect(screen.getByText(/33\.8688° S/)).toBeInTheDocument()
    expect(screen.getByText(/151\.2093° E/)).toBeInTheDocument()
  })

  it("handles eastern longitude correctly", () => {
    const easternPosition: GeoPosition = {
      latitude: 51.5074,
      longitude: 0.1278,
      timestamp: 1700000000000,
    }

    render(<LocationBadge position={easternPosition} />)

    expect(screen.getByText(/51\.5074° N/)).toBeInTheDocument()
    expect(screen.getByText(/0\.1278° E/)).toBeInTheDocument()
  })

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

  it("has accessible aria-label", () => {
    render(<LocationBadge position={mockPosition} />)

    expect(screen.getByLabelText(/Location: 40\.7128° N, 74\.0060° W/)).toBeInTheDocument()
  })
})
