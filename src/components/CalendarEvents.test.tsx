import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CalendarEvents } from "./CalendarEvents"
import { useGoogleCalendar } from "../hooks/useGoogleCalendar"
import type { CalendarEvent } from "../lib/google-calendar"

// Mock the useGoogleCalendar hook
vi.mock("../hooks/useGoogleCalendar", () => ({
  useGoogleCalendar: vi.fn(),
}))

const mockUseGoogleCalendar = useGoogleCalendar as Mock

describe("CalendarEvents", () => {
  const mockEvents: CalendarEvent[] = [
    {
      id: "1",
      summary: "Team Meeting",
      start: "2024-01-15T09:00:00",
      end: "2024-01-15T10:00:00",
      isAllDay: false,
      calendarId: "primary",
      status: "confirmed",
      htmlLink: "https://calendar.google.com/event/1",
    },
    {
      id: "2",
      summary: "Lunch with Client",
      description: "Discuss Q1 plans",
      location: "Downtown Cafe",
      start: "2024-01-15T12:00:00",
      end: "2024-01-15T13:00:00",
      isAllDay: false,
      calendarId: "primary",
      status: "confirmed",
    },
    {
      id: "3",
      summary: "Company Holiday",
      start: "2024-01-15",
      end: "2024-01-16",
      isAllDay: true,
      calendarId: "primary",
      status: "confirmed",
    },
  ]

  const mockAuthenticate = vi.fn()
  const mockFetchEvents = vi.fn()
  const mockClearError = vi.fn()
  const mockSignOut = vi.fn()
  const mockHandleCallback = vi.fn()

  const defaultMockReturn = {
    authState: "authenticated" as const,
    isLoading: false,
    error: null,
    events: mockEvents,
    authenticate: mockAuthenticate,
    fetchEvents: mockFetchEvents,
    signOut: mockSignOut,
    clearError: mockClearError,
    handleCallback: mockHandleCallback,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGoogleCalendar.mockReturnValue(defaultMockReturn)
  })

  describe("non-authenticated states", () => {
    it("renders nothing when Google Calendar is unconfigured", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        authState: "unconfigured",
        events: [],
      })

      const { container } = render(<CalendarEvents date="2024-01-15" />)

      expect(container.firstChild).toBeNull()
    })

    it("renders nothing when unauthenticated", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        authState: "unauthenticated",
        events: [],
      })

      const { container } = render(<CalendarEvents date="2024-01-15" />)

      expect(container.firstChild).toBeNull()
    })

    it("renders nothing when authenticating", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        authState: "authenticating",
        events: [],
      })

      const { container } = render(<CalendarEvents date="2024-01-15" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe("authenticated state", () => {
    it("renders calendar events", () => {
      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText("Team Meeting")).toBeInTheDocument()
      expect(screen.getByText("Lunch with Client")).toBeInTheDocument()
      expect(screen.getByText("Company Holiday")).toBeInTheDocument()
    })

    it("displays event times correctly", () => {
      render(<CalendarEvents date="2024-01-15" />)

      // Use locale-aware formatting for expected values
      const formatTime = (date: Date) =>
        date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })
      const time9am = formatTime(new Date("2024-01-15T09:00:00"))
      const time10am = formatTime(new Date("2024-01-15T10:00:00"))
      const time12pm = formatTime(new Date("2024-01-15T12:00:00"))
      const time1pm = formatTime(new Date("2024-01-15T13:00:00"))

      expect(screen.getByText(new RegExp(`${time9am} - ${time10am}`))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(`${time12pm} - ${time1pm}`))).toBeInTheDocument()
    })

    it("displays 'All day' for all-day events", () => {
      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText("All day")).toBeInTheDocument()
    })

    it("displays event location when available", () => {
      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText(/Downtown Cafe/)).toBeInTheDocument()
    })

    it("renders external link for events with htmlLink", () => {
      render(<CalendarEvents date="2024-01-15" />)

      const link = screen.getByLabelText("Open Team Meeting in Google Calendar")
      expect(link).toHaveAttribute("href", "https://calendar.google.com/event/1")
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    })

    it("fetches events when date changes", () => {
      const { rerender } = render(<CalendarEvents date="2024-01-15" />)

      expect(mockFetchEvents).toHaveBeenCalledWith("2024-01-15")

      rerender(<CalendarEvents date="2024-01-16" />)

      expect(mockFetchEvents).toHaveBeenCalledWith("2024-01-16")
    })

    it("shows no events message when events array is empty", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        events: [],
      })

      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText("No events scheduled for this day.")).toBeInTheDocument()
    })
  })

  describe("loading state", () => {
    it("shows loading skeletons when loading", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        events: [],
      })

      render(<CalendarEvents date="2024-01-15" />)

      const skeletons = document.querySelectorAll(".animate-pulse")
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe("error state", () => {
    it("displays error message when there is an error", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        error: "Failed to fetch events",
      })

      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByRole("alert")).toBeInTheDocument()
      expect(screen.getByText("Failed to fetch events")).toBeInTheDocument()
    })

    it("calls clearError when dismiss button is clicked", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        error: "Failed to fetch events",
      })

      render(<CalendarEvents date="2024-01-15" />)

      fireEvent.click(screen.getByLabelText("Dismiss error"))

      expect(mockClearError).toHaveBeenCalledTimes(1)
    })
  })

  describe("event status", () => {
    it("shows cancelled events with strikethrough", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        events: [
          {
            id: "cancelled-1",
            summary: "Cancelled Meeting",
            start: "2024-01-15T14:00:00",
            end: "2024-01-15T15:00:00",
            isAllDay: false,
            calendarId: "primary",
            status: "cancelled",
          },
        ],
      })

      render(<CalendarEvents date="2024-01-15" />)

      const eventTitle = screen.getByText("Cancelled Meeting")
      expect(eventTitle).toHaveClass("line-through")
    })

    it("shows tentative indicator for tentative events", () => {
      mockUseGoogleCalendar.mockReturnValue({
        ...defaultMockReturn,
        events: [
          {
            id: "tentative-1",
            summary: "Maybe Meeting",
            start: "2024-01-15T16:00:00",
            end: "2024-01-15T17:00:00",
            isAllDay: false,
            calendarId: "primary",
            status: "tentative",
          },
        ],
      })

      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText("Maybe Meeting")).toBeInTheDocument()
      expect(screen.getByText("(tentative)")).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has accessible events list", () => {
      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByRole("list", { name: "Calendar events" })).toBeInTheDocument()
    })

    it("renders calendar heading", () => {
      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText("Calendar")).toBeInTheDocument()
    })
  })
})
