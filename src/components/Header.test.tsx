import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Header } from "./Header"
import type { GeoPosition } from "../hooks/useGeolocation"

// Mock the JournalContext since DatePicker uses it
vi.mock("../context/JournalContext", () => ({
  useJournal: () => ({
    doc: {
      entries: {},
      settings: {
        displayName: "",
        timezone: "UTC",
        theme: "system",
      },
    },
    changeDoc: vi.fn(),
    handle: undefined,
    isLoading: false,
  }),
}))

// Mock the useReverseGeocode hook for LocationBadge
vi.mock("../hooks/useReverseGeocode", () => ({
  useReverseGeocode: vi.fn(() => ({
    locality: "New York",
    displayName: "New York, NY, United States",
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

describe("Header", () => {
  beforeEach(() => {
    // Reset location hash before each test
    window.location.hash = ""
  })

  it("renders the formatted date with day of week and month/day", () => {
    render(<Header date="2024-01-15" />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toBeInTheDocument()
    // Use locale-aware formatting for expected values
    const date = new Date(2024, 0, 15)
    const expectedDayOfWeek = date.toLocaleDateString(undefined, { weekday: "long" })
    const expectedMonthDay = date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    expect(heading).toHaveTextContent(expectedDayOfWeek)
    expect(heading).toHaveTextContent(expectedMonthDay)
  })

  it("formats different dates correctly", () => {
    render(<Header date="2024-06-20" />)

    const heading = screen.getByRole("heading", { level: 1 })
    // Use locale-aware formatting for expected values
    const date = new Date(2024, 5, 20)
    const expectedDayOfWeek = date.toLocaleDateString(undefined, { weekday: "long" })
    const expectedMonthDay = date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    expect(heading).toHaveTextContent(expectedDayOfWeek)
    expect(heading).toHaveTextContent(expectedMonthDay)
  })

  it("omits year for current year dates", () => {
    const currentYear = new Date().getFullYear()
    render(<Header date={`${currentYear}-03-15`} />)

    const heading = screen.getByRole("heading", { level: 1 })
    // Use locale-aware formatting for expected values
    const date = new Date(currentYear, 2, 15)
    const expectedMonthDay = date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })
    expect(heading).toHaveTextContent(expectedMonthDay)
    expect(heading).not.toHaveTextContent(`${currentYear}`)
  })

  describe("navigation controls", () => {
    it("renders navigation buttons when showNavigation is true (default)", () => {
      render(<Header date="2024-01-15" />)

      expect(screen.getByRole("button", { name: /previous day/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /open calendar/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /next day/i })).toBeInTheDocument()
    })

    it("does not render navigation buttons when showNavigation is false", () => {
      render(<Header date="2024-01-15" showNavigation={false} />)

      expect(screen.queryByRole("button", { name: /previous day/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /open calendar/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /next day/i })).not.toBeInTheDocument()
    })

    it("navigates to previous day when previous button is clicked", () => {
      render(<Header date="2024-01-15" />)

      const prevButton = screen.getByRole("button", { name: /previous day/i })
      fireEvent.click(prevButton)

      expect(window.location.hash).toBe("#/day/2024-01-14")
    })

    it("navigates to next day when next button is clicked", () => {
      render(<Header date="2024-01-15" />)

      const nextButton = screen.getByRole("button", { name: /next day/i })
      fireEvent.click(nextButton)

      expect(window.location.hash).toBe("#/day/2024-01-16")
    })

    it("renders a clickable calendar button that opens date picker", () => {
      render(<Header date="2024-01-15" />)

      const calendarButton = screen.getByRole("button", { name: /open calendar/i })
      expect(calendarButton).toBeInTheDocument()
      expect(calendarButton).toHaveAttribute("aria-haspopup", "dialog")
    })

    it("opens date picker when calendar button is clicked", () => {
      render(<Header date="2024-01-15" />)

      const calendarButton = screen.getByRole("button", { name: /open calendar/i })
      fireEvent.click(calendarButton)

      // Date picker should now be visible - look for month navigation
      expect(screen.getByLabelText("Previous month")).toBeInTheDocument()
      expect(screen.getByLabelText("Next month")).toBeInTheDocument()
      expect(screen.getByText("Go to Today")).toBeInTheDocument()
    })

    it("opens date picker when date label is clicked", () => {
      render(<Header date="2024-01-15" />)

      // The date label is now part of the calendar button
      // Use locale-aware formatting for expected values
      const date = new Date(2024, 0, 15)
      const expectedMonthDay = date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })

      // Find and click the button containing the date text
      const calendarButton = screen.getByRole("button", { name: /open calendar/i })
      expect(calendarButton).toHaveTextContent(expectedMonthDay)
      fireEvent.click(calendarButton)

      // Date picker should now be visible
      expect(screen.getByText("Go to Today")).toBeInTheDocument()
    })

    it("closes date picker when clicking outside", () => {
      render(<Header date="2024-01-15" />)

      const calendarButton = screen.getByRole("button", { name: /open calendar/i })
      fireEvent.click(calendarButton)

      // Verify date picker is open
      expect(screen.getByText("Go to Today")).toBeInTheDocument()

      // Click outside (on the document body)
      fireEvent.mouseDown(document.body)

      // Date picker should be closed
      expect(screen.queryByText("Go to Today")).not.toBeInTheDocument()
    })

    it("closes date picker when pressing Escape", () => {
      render(<Header date="2024-01-15" />)

      const calendarButton = screen.getByRole("button", { name: /open calendar/i })
      fireEvent.click(calendarButton)

      // Verify date picker is open
      expect(screen.getByText("Go to Today")).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" })

      // Date picker should be closed
      expect(screen.queryByText("Go to Today")).not.toBeInTheDocument()
    })

    it("navigates to selected date when a date is clicked in the picker", () => {
      render(<Header date="2024-01-15" />)

      const calendarButton = screen.getByRole("button", { name: /open calendar/i })
      fireEvent.click(calendarButton)

      // Click on a date (January 20, 2024)
      const day20 = screen.getByRole("button", { name: "2024-01-20" })
      fireEvent.click(day20)

      // Should navigate to the selected date
      expect(window.location.hash).toBe("#/day/2024-01-20")

      // Date picker should be closed
      expect(screen.queryByText("Go to Today")).not.toBeInTheDocument()
    })
  })

  describe("location display", () => {
    const mockPosition: GeoPosition = {
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 100,
      timestamp: 1700000000000,
    }

    it("does not render location badge when position is not provided", () => {
      render(<Header date="2024-01-15" />)

      expect(screen.queryByText("New York")).not.toBeInTheDocument()
    })

    it("does not render location badge when position is null", () => {
      render(<Header date="2024-01-15" position={null} />)

      expect(screen.queryByText("New York")).not.toBeInTheDocument()
    })

    it("renders location badge when position is provided", () => {
      render(<Header date="2024-01-15" position={mockPosition} />)

      expect(screen.getByText("New York")).toBeInTheDocument()
    })

    it("renders location badge next to the date", () => {
      render(<Header date="2024-01-15" position={mockPosition} />)

      const heading = screen.getByRole("heading", { level: 1 })
      expect(heading).toContainElement(screen.getByText("New York"))
    })

    it("calls onLocationClick when location badge is clicked", () => {
      const handleLocationClick = vi.fn()

      render(
        <Header date="2024-01-15" position={mockPosition} onLocationClick={handleLocationClick} />,
      )

      const locationButton = screen.getByRole("button", { name: /location/i })
      fireEvent.click(locationButton)

      expect(handleLocationClick).toHaveBeenCalledTimes(1)
    })
  })

  describe("future date prevention", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("disables next day button when viewing today", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0)) // January 16, 2026

      render(<Header date="2026-01-16" />)

      const nextButton = screen.getByRole("button", { name: /next day/i })
      expect(nextButton).toBeDisabled()
      expect(nextButton).toHaveAttribute("aria-disabled", "true")
    })

    it("enables next day button when viewing a past date", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0)) // January 16, 2026

      render(<Header date="2026-01-15" />)

      const nextButton = screen.getByRole("button", { name: /next day/i })
      expect(nextButton).not.toBeDisabled()
    })

    it("does not navigate when clicking disabled next day button", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0)) // January 16, 2026

      render(<Header date="2026-01-16" />)

      const nextButton = screen.getByRole("button", { name: /next day/i })
      fireEvent.click(nextButton)

      expect(window.location.hash).toBe("")
    })
  })
})
