import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DatePicker } from "./DatePicker"
import { toDateString } from "../types/journal"

// Mock the JournalContext to control the entries data
vi.mock("../context/JournalContext", async () => {
  const actual = await vi.importActual("../context/JournalContext")
  return {
    ...actual,
    useJournal: vi.fn(),
  }
})

import { useJournal } from "../context/JournalContext"
const mockedUseJournal = vi.mocked(useJournal)

describe("DatePicker", () => {
  beforeEach(() => {
    mockedUseJournal.mockReturnValue({
      doc: {
        entries: {},
        settings: {
          displayName: "",
          timezone: "America/New_York",
          theme: "system",
          llmProvider: "claude",
        },
      },
      changeDoc: vi.fn(),
      handle: undefined,
      isLoading: false,
    })
  })

  it("has accessible dialog role and label", () => {
    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    const dialog = screen.getByRole("dialog", { name: "Date picker" })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute("aria-modal", "true")
  })

  it("renders the current month and year", () => {
    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    // Use locale-aware formatting for expected value
    const expectedMonthYear = new Date(2024, 5).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    expect(screen.getByText(expectedMonthYear)).toBeInTheDocument()
  })

  it("renders weekday headers", () => {
    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    // Get expected localized weekday abbreviations (Sunday to Saturday)
    // Jan 7, 2024 was a Sunday
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: "short" })
    const expectedWeekdays = Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(2024, 0, 7 + i)),
    )

    for (const weekday of expectedWeekdays) {
      expect(screen.getByText(weekday)).toBeInTheDocument()
    }
  })

  it("calls onDateSelect when a date is clicked", async () => {
    const user = userEvent.setup()
    const onDateSelect = vi.fn()

    render(<DatePicker selectedDate="2024-06-15" onDateSelect={onDateSelect} />)

    // Click on June 20th
    const dateButton = screen.getByRole("button", { name: "2024-06-20" })
    await user.click(dateButton)

    expect(onDateSelect).toHaveBeenCalledWith("2024-06-20")
  })

  it("navigates to previous month", async () => {
    const user = userEvent.setup()

    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    const prevButton = screen.getByRole("button", { name: "Previous month" })
    await user.click(prevButton)

    // Use locale-aware formatting for expected value
    const expectedMonthYear = new Date(2024, 4).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    expect(screen.getByText(expectedMonthYear)).toBeInTheDocument()
  })

  it("navigates to next month", async () => {
    const user = userEvent.setup()

    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    const nextButton = screen.getByRole("button", { name: "Next month" })
    await user.click(nextButton)

    // Use locale-aware formatting for expected value
    const expectedMonthYear = new Date(2024, 6).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    expect(screen.getByText(expectedMonthYear)).toBeInTheDocument()
  })

  it("shows 'Go to Today' button", () => {
    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    expect(screen.getByRole("button", { name: /go to today/i })).toBeInTheDocument()
  })

  it("calls onClose when a date is selected", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} onClose={onClose} />)

    const dateButton = screen.getByRole("button", { name: "2024-06-20" })
    await user.click(dateButton)

    expect(onClose).toHaveBeenCalled()
  })

  it("shows dots on days with entries", () => {
    const date1 = toDateString("2024-06-10")
    const date2 = toDateString("2024-06-15")
    mockedUseJournal.mockReturnValue({
      doc: {
        entries: {
          [date1]: {
            id: "entry-1",
            date: date1,
            messages: [{ id: "msg-1", role: "user", content: "Hello", createdAt: Date.now() }],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          [date2]: {
            id: "entry-2",
            date: date2,
            messages: [{ id: "msg-2", role: "user", content: "World", createdAt: Date.now() }],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        settings: {
          displayName: "",
          timezone: "America/New_York",
          theme: "system",
          llmProvider: "claude",
        },
      },
      changeDoc: vi.fn(),
      handle: undefined,
      isLoading: false,
    })

    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    // The date button for June 10 should have an entry dot (span child)
    const june10Button = screen.getByRole("button", { name: "2024-06-10" })
    expect(june10Button.querySelector("span")).toBeInTheDocument()

    // The date button for June 15 (selected) should also have an entry dot
    const june15Button = screen.getByRole("button", { name: "2024-06-15" })
    expect(june15Button.querySelector("span")).toBeInTheDocument()

    // A date without entry should not have a dot
    const june16Button = screen.getByRole("button", { name: "2024-06-16" })
    expect(june16Button.querySelector("span")).not.toBeInTheDocument()
  })

  it("does not show dots for entries with empty messages", () => {
    const date1 = toDateString("2024-06-10")
    mockedUseJournal.mockReturnValue({
      doc: {
        entries: {
          [date1]: {
            id: "entry-1",
            date: date1,
            messages: [], // Empty messages array
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        settings: {
          displayName: "",
          timezone: "America/New_York",
          theme: "system",
          llmProvider: "claude",
        },
      },
      changeDoc: vi.fn(),
      handle: undefined,
      isLoading: false,
    })

    render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

    // June 10 should NOT have a dot because messages array is empty
    const june10Button = screen.getByRole("button", { name: "2024-06-10" })
    expect(june10Button.querySelector("span")).not.toBeInTheDocument()
  })

  it("handles year transition when navigating months", async () => {
    const user = userEvent.setup()

    render(<DatePicker selectedDate="2024-01-15" onDateSelect={vi.fn()} />)

    // Use locale-aware formatting for expected values
    const expectedJan2024 = new Date(2024, 0).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    expect(screen.getByText(expectedJan2024)).toBeInTheDocument()

    // Navigate to previous month (December 2023)
    const prevButton = screen.getByRole("button", { name: "Previous month" })
    await user.click(prevButton)

    const expectedDec2023 = new Date(2023, 11).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    expect(screen.getByText(expectedDec2023)).toBeInTheDocument()
  })

  describe("future date prevention", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("disables future dates", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)) // June 15, 2024

      render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

      // Future dates should be disabled
      const june16Button = screen.getByRole("button", { name: "2024-06-16" })
      expect(june16Button).toBeDisabled()
      expect(june16Button).toHaveAttribute("aria-disabled", "true")

      const june20Button = screen.getByRole("button", { name: "2024-06-20" })
      expect(june20Button).toBeDisabled()
    })

    it("does not call onDateSelect when clicking future date", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)) // June 15, 2024

      const onDateSelect = vi.fn()

      render(<DatePicker selectedDate="2024-06-15" onDateSelect={onDateSelect} />)

      // Try to click on future date
      const june20Button = screen.getByRole("button", { name: "2024-06-20" })
      june20Button.click()

      expect(onDateSelect).not.toHaveBeenCalled()
    })

    it("allows clicking today", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)) // June 15, 2024

      const onDateSelect = vi.fn()

      render(<DatePicker selectedDate="2024-06-10" onDateSelect={onDateSelect} />)

      // Today should be clickable
      const todayButton = screen.getByRole("button", { name: "2024-06-15" })
      expect(todayButton).not.toBeDisabled()

      todayButton.click()
      expect(onDateSelect).toHaveBeenCalledWith("2024-06-15")
    })

    it("allows clicking past dates", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)) // June 15, 2024

      const onDateSelect = vi.fn()

      render(<DatePicker selectedDate="2024-06-15" onDateSelect={onDateSelect} />)

      // Past dates should be clickable
      const june10Button = screen.getByRole("button", { name: "2024-06-10" })
      expect(june10Button).not.toBeDisabled()

      june10Button.click()
      expect(onDateSelect).toHaveBeenCalledWith("2024-06-10")
    })

    it("shows tooltip explaining why future dates are disabled", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)) // June 15, 2024

      render(<DatePicker selectedDate="2024-06-15" onDateSelect={vi.fn()} />)

      // Future dates should have a tooltip explaining why they can't be selected
      const june16Button = screen.getByRole("button", { name: "2024-06-16" })
      expect(june16Button).toHaveAttribute("title", "Cannot select future dates")

      const june20Button = screen.getByRole("button", { name: "2024-06-20" })
      expect(june20Button).toHaveAttribute("title", "Cannot select future dates")

      // Today and past dates should not have this tooltip
      const todayButton = screen.getByRole("button", { name: "2024-06-15" })
      expect(todayButton).not.toHaveAttribute("title")

      const june10Button = screen.getByRole("button", { name: "2024-06-10" })
      expect(june10Button).not.toHaveAttribute("title")
    })
  })
})
