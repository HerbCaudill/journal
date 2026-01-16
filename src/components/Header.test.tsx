import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Header } from "./Header"

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

describe("Header", () => {
  beforeEach(() => {
    // Reset location hash before each test
    window.location.hash = ""
  })

  it("renders the formatted date with day of week and month/day", () => {
    render(<Header date="2024-01-15" />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent("Monday")
    expect(heading).toHaveTextContent("January 15, 2024")
  })

  it("renders a settings link", () => {
    render(<Header date="2024-01-15" />)

    const settingsLink = screen.getByRole("link", { name: /settings/i })
    expect(settingsLink).toBeInTheDocument()
    expect(settingsLink).toHaveAttribute("href", "#/settings")
  })

  it("formats different dates correctly", () => {
    render(<Header date="2024-06-20" />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday")
    expect(heading).toHaveTextContent("June 20, 2024")
  })

  it("omits year for current year dates", () => {
    const currentYear = new Date().getFullYear()
    render(<Header date={`${currentYear}-03-15`} />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("March 15")
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
})
