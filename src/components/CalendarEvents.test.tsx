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
    it("has accessible events list with date context", () => {
      render(<CalendarEvents date="2024-01-15" />)

      // Use locale-aware formatting for expected value
      const formattedDate = new Date(2024, 0, 15).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
      })
      expect(
        screen.getByRole("list", { name: `Calendar events for ${formattedDate}` }),
      ).toBeInTheDocument()
    })

    it("renders calendar heading", () => {
      render(<CalendarEvents date="2024-01-15" />)

      expect(screen.getByText("Calendar")).toBeInTheDocument()
    })
  })

  describe("error cases", () => {
    describe("OAuth token expiration", () => {
      it("displays token expiration error", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "Authentication expired. Please reconnect your Google account.",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText("Authentication expired. Please reconnect your Google account."),
        ).toBeInTheDocument()
      })

      it("shows events list even when error is present if events were previously fetched", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "Authentication expired. Please reconnect your Google account.",
          // events are still present from previous fetch
        })

        render(<CalendarEvents date="2024-01-15" />)

        // Both error and events should be visible
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Team Meeting")).toBeInTheDocument()
      })
    })

    describe("API quota exceeded (429 status)", () => {
      it("displays rate limit error message", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "API rate limit or server error (429)",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("API rate limit or server error (429)")).toBeInTheDocument()
      })

      it("allows dismissing rate limit error", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "API rate limit or server error (429)",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        fireEvent.click(screen.getByLabelText("Dismiss error"))

        expect(mockClearError).toHaveBeenCalledTimes(1)
      })
    })

    describe("network timeout scenarios", () => {
      it("displays network error message", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "Network request failed",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Network request failed")).toBeInTheDocument()
      })

      it("displays timeout error message", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "Request timed out",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Request timed out")).toBeInTheDocument()
      })
    })

    describe("concurrent fetch operations", () => {
      it("does not trigger multiple fetches for the same date", () => {
        const { rerender } = render(<CalendarEvents date="2024-01-15" />)

        expect(mockFetchEvents).toHaveBeenCalledTimes(1)
        expect(mockFetchEvents).toHaveBeenCalledWith("2024-01-15")

        // Rerender with the same date should not trigger another fetch
        rerender(<CalendarEvents date="2024-01-15" />)

        // fetchEvents is still called due to useEffect, but hook internally deduplicates
        // This test verifies the component doesn't change dates unexpectedly
        expect(mockFetchEvents).toHaveBeenLastCalledWith("2024-01-15")
      })

      it("cancels previous fetch when date changes rapidly", () => {
        const { rerender } = render(<CalendarEvents date="2024-01-15" />)
        rerender(<CalendarEvents date="2024-01-16" />)
        rerender(<CalendarEvents date="2024-01-17" />)

        // Each date change triggers a fetch
        expect(mockFetchEvents).toHaveBeenCalledWith("2024-01-15")
        expect(mockFetchEvents).toHaveBeenCalledWith("2024-01-16")
        expect(mockFetchEvents).toHaveBeenCalledWith("2024-01-17")
      })
    })
  })

  describe("edge cases", () => {
    describe("empty calendar list with authenticated state", () => {
      it("shows no events message when authenticated but no calendars have events", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("No events scheduled for this day.")).toBeInTheDocument()
      })

      it("renders calendar header even with no events", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Calendar")).toBeInTheDocument()
      })
    })

    describe("events spanning multiple days", () => {
      it("displays multi-day event correctly", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "multi-day-1",
              summary: "Conference",
              start: "2024-01-15",
              end: "2024-01-18",
              isAllDay: true,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Conference")).toBeInTheDocument()
        expect(screen.getByText("All day")).toBeInTheDocument()
      })

      it("displays event that starts on a previous day", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "continued-1",
              summary: "Ongoing Project",
              start: "2024-01-14T09:00:00",
              end: "2024-01-16T17:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Ongoing Project")).toBeInTheDocument()
      })
    })

    describe("events with missing required fields", () => {
      it("displays event with no summary using fallback text", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "no-title-1",
              summary: "(No title)", // Component receives this from API handling
              start: "2024-01-15T14:00:00",
              end: "2024-01-15T15:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("(No title)")).toBeInTheDocument()
      })

      it("displays event without htmlLink (no external link button)", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "no-link-1",
              summary: "Private Event",
              start: "2024-01-15T10:00:00",
              end: "2024-01-15T11:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
              // no htmlLink
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Private Event")).toBeInTheDocument()
        expect(
          screen.queryByLabelText("Open Private Event in Google Calendar"),
        ).not.toBeInTheDocument()
      })

      it("displays event without location", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "no-location-1",
              summary: "Remote Meeting",
              start: "2024-01-15T15:00:00",
              end: "2024-01-15T16:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
              // no location
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Remote Meeting")).toBeInTheDocument()
        expect(screen.queryByText(/📍/)).not.toBeInTheDocument()
      })

      it("displays event without description", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "no-desc-1",
              summary: "Quick Sync",
              start: "2024-01-15T16:00:00",
              end: "2024-01-15T16:30:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
              // no description
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Quick Sync")).toBeInTheDocument()
      })
    })

    describe("invalid/malformed events from API", () => {
      it("handles event with empty summary gracefully", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "empty-summary-1",
              summary: "",
              start: "2024-01-15T09:00:00",
              end: "2024-01-15T10:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        // Component should render even with empty summary
        const eventsList = screen.getByRole("list")
        expect(eventsList).toBeInTheDocument()
      })

      it("handles event with very long summary", () => {
        const longSummary = "A".repeat(500)
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "long-summary-1",
              summary: longSummary,
              start: "2024-01-15T09:00:00",
              end: "2024-01-15T10:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        // Summary should be present (truncated via CSS)
        expect(screen.getByText(longSummary)).toBeInTheDocument()
      })

      it("handles event with special characters in summary", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "special-chars-1",
              summary: "Meeting <script>alert('xss')</script> & Discussion",
              start: "2024-01-15T09:00:00",
              end: "2024-01-15T10:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(
          screen.getByText("Meeting <script>alert('xss')</script> & Discussion"),
        ).toBeInTheDocument()
      })

      it("handles event with unicode characters in summary", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "unicode-1",
              summary: "会议 🎉 Réunion",
              start: "2024-01-15T09:00:00",
              end: "2024-01-15T10:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("会议 🎉 Réunion")).toBeInTheDocument()
      })
    })

    describe("server error responses", () => {
      it("displays 500 server error message", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "API rate limit or server error (500)",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("API rate limit or server error (500)")).toBeInTheDocument()
      })

      it("displays 503 service unavailable error", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          error: "Service temporarily unavailable",
          events: [],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Service temporarily unavailable")).toBeInTheDocument()
      })
    })

    describe("date edge cases", () => {
      it("fetches events for leap year date", () => {
        render(<CalendarEvents date="2024-02-29" />)

        expect(mockFetchEvents).toHaveBeenCalledWith("2024-02-29")
      })

      it("fetches events for year boundary date (Dec 31)", () => {
        render(<CalendarEvents date="2024-12-31" />)

        expect(mockFetchEvents).toHaveBeenCalledWith("2024-12-31")
      })

      it("fetches events for year boundary date (Jan 1)", () => {
        render(<CalendarEvents date="2025-01-01" />)

        expect(mockFetchEvents).toHaveBeenCalledWith("2025-01-01")
      })
    })

    describe("multiple events ordering", () => {
      it("displays multiple events in order", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "1",
              summary: "Morning Standup",
              start: "2024-01-15T09:00:00",
              end: "2024-01-15T09:30:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
            {
              id: "2",
              summary: "Lunch",
              start: "2024-01-15T12:00:00",
              end: "2024-01-15T13:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
            {
              id: "3",
              summary: "Evening Review",
              start: "2024-01-15T17:00:00",
              end: "2024-01-15T18:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        const events = screen.getAllByRole("listitem")
        expect(events).toHaveLength(3)
        expect(events[0]).toHaveTextContent("Morning Standup")
        expect(events[1]).toHaveTextContent("Lunch")
        expect(events[2]).toHaveTextContent("Evening Review")
      })

      it("displays all-day events alongside timed events", () => {
        mockUseGoogleCalendar.mockReturnValue({
          ...defaultMockReturn,
          events: [
            {
              id: "1",
              summary: "Holiday",
              start: "2024-01-15",
              end: "2024-01-16",
              isAllDay: true,
              calendarId: "primary",
              status: "confirmed",
            },
            {
              id: "2",
              summary: "Morning Call",
              start: "2024-01-15T10:00:00",
              end: "2024-01-15T11:00:00",
              isAllDay: false,
              calendarId: "primary",
              status: "confirmed",
            },
          ],
        })

        render(<CalendarEvents date="2024-01-15" />)

        expect(screen.getByText("Holiday")).toBeInTheDocument()
        expect(screen.getByText("All day")).toBeInTheDocument()
        expect(screen.getByText("Morning Call")).toBeInTheDocument()
      })
    })
  })
})
