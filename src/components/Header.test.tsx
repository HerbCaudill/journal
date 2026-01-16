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

  it("renders a clickable date button that opens date picker", () => {
    render(<Header date="2024-01-15" />)

    const dateButton = screen.getByRole("button", { expanded: false })
    expect(dateButton).toBeInTheDocument()
    expect(dateButton).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("opens date picker when date button is clicked", () => {
    render(<Header date="2024-01-15" />)

    const dateButton = screen.getByRole("button", { expanded: false })
    fireEvent.click(dateButton)

    // Date picker should now be visible - look for month navigation
    expect(screen.getByLabelText("Previous month")).toBeInTheDocument()
    expect(screen.getByLabelText("Next month")).toBeInTheDocument()
    expect(screen.getByText("Go to Today")).toBeInTheDocument()
  })

  it("closes date picker when clicking outside", () => {
    render(<Header date="2024-01-15" />)

    const dateButton = screen.getByRole("button", { expanded: false })
    fireEvent.click(dateButton)

    // Verify date picker is open
    expect(screen.getByText("Go to Today")).toBeInTheDocument()

    // Click outside (on the document body)
    fireEvent.mouseDown(document.body)

    // Date picker should be closed
    expect(screen.queryByText("Go to Today")).not.toBeInTheDocument()
  })

  it("closes date picker when pressing Escape", () => {
    render(<Header date="2024-01-15" />)

    const dateButton = screen.getByRole("button", { expanded: false })
    fireEvent.click(dateButton)

    // Verify date picker is open
    expect(screen.getByText("Go to Today")).toBeInTheDocument()

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" })

    // Date picker should be closed
    expect(screen.queryByText("Go to Today")).not.toBeInTheDocument()
  })

  it("navigates to selected date when a date is clicked in the picker", () => {
    render(<Header date="2024-01-15" />)

    const dateButton = screen.getByRole("button", { expanded: false })
    fireEvent.click(dateButton)

    // Click on a date (January 20, 2024)
    const day20 = screen.getByRole("button", { name: "2024-01-20" })
    fireEvent.click(day20)

    // Should navigate to the selected date
    expect(window.location.hash).toBe("#/day/2024-01-20")

    // Date picker should be closed
    expect(screen.queryByText("Go to Today")).not.toBeInTheDocument()
  })
})
