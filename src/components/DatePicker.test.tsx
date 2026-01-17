import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DatePicker } from "./DatePicker"

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

    expect(screen.getByText("Su")).toBeInTheDocument()
    expect(screen.getByText("Mo")).toBeInTheDocument()
    expect(screen.getByText("Tu")).toBeInTheDocument()
    expect(screen.getByText("We")).toBeInTheDocument()
    expect(screen.getByText("Th")).toBeInTheDocument()
    expect(screen.getByText("Fr")).toBeInTheDocument()
    expect(screen.getByText("Sa")).toBeInTheDocument()
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
    mockedUseJournal.mockReturnValue({
      doc: {
        entries: {
          "entry-1": {
            id: "entry-1",
            date: "2024-06-10",
            messages: [{ id: "msg-1", role: "user", content: "Hello", createdAt: Date.now() }],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          "entry-2": {
            id: "entry-2",
            date: "2024-06-15",
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
    mockedUseJournal.mockReturnValue({
      doc: {
        entries: {
          "entry-1": {
            id: "entry-1",
            date: "2024-06-10",
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
})
