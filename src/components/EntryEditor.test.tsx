import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EntryEditor } from "./EntryEditor"
import * as JournalContext from "../context/JournalContext"
import type { JournalDoc } from "../types/journal"
import type { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge"
import { AUTOSAVE_DEBOUNCE_DELAY, SAVED_INDICATOR_DURATION } from "@/lib/timing"

// Mock the useJournal hook
vi.mock("../context/JournalContext", async () => {
  const actual = await vi.importActual("../context/JournalContext")
  return {
    ...actual,
    useJournal: vi.fn(),
  }
})

const mockUseJournal = vi.mocked(JournalContext.useJournal)

type ChangeDocFn = (changeFn: ChangeFn<JournalDoc>, options?: ChangeOptions<JournalDoc>) => void

describe("EntryEditor", () => {
  let mockChangeDoc: ReturnType<typeof vi.fn<ChangeDocFn>>
  let mockDoc: Doc<JournalDoc>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockChangeDoc = vi.fn()
    mockDoc = {
      entries: {},
      settings: {
        displayName: "",
        timezone: "UTC",
        theme: "system",
      },
    } as Doc<JournalDoc>

    mockUseJournal.mockReturnValue({
      doc: mockDoc,
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("renders a textarea", () => {
    render(<EntryEditor date="2024-01-15" />)

    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    expect(textarea).toBeInTheDocument()
  })

  it("accepts user input", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<EntryEditor date="2024-01-15" />)

    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    await user.type(textarea, "Hello, journal!")

    expect(textarea).toHaveValue("Hello, journal!")
  })

  it("debounces saves to the document", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<EntryEditor date="2024-01-15" />)

    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    await user.type(textarea, "Test")

    // Should not have called changeDoc yet (debounce not elapsed)
    expect(mockChangeDoc).not.toHaveBeenCalled()

    // Advance time past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_DELAY + 100)
    })

    // Now it should have been called
    expect(mockChangeDoc).toHaveBeenCalledTimes(1)
  })

  it("shows loading state when document is loading", () => {
    mockUseJournal.mockReturnValue({
      doc: undefined,
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: true,
    })

    render(<EntryEditor date="2024-01-15" />)

    // Should show loading skeleton
    const loadingDiv = document.querySelector(".animate-pulse")
    expect(loadingDiv).toBeInTheDocument()
  })

  it("loads existing content from document", () => {
    const docWithEntry = {
      entries: {
        "2024-01-15": {
          id: "entry-1",
          date: "2024-01-15",
          messages: [
            {
              id: "msg-1",
              role: "user" as const,
              content: "Existing content",
              createdAt: Date.now(),
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      settings: {
        displayName: "",
        timezone: "UTC",
        theme: "system" as const,
        llmProvider: "claude" as const,
      },
    } as Doc<JournalDoc>

    mockUseJournal.mockReturnValue({
      doc: docWithEntry,
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<EntryEditor date="2024-01-15" />)

    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    expect(textarea).toHaveValue("Existing content")
  })

  describe("save indicator", () => {
    it('shows "Saving..." while debounce timer is active', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(<EntryEditor date="2024-01-15" />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test")

      // Should show "Saving..." indicator
      expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saving...")
    })

    it('shows "Saved" after debounce completes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(<EntryEditor date="2024-01-15" />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test")

      // Advance time past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_DELAY + 100)
      })

      // Should show "Saved" indicator
      expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saved")
    })

    it("hides save indicator after delay", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(<EntryEditor date="2024-01-15" />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test")

      // Advance time past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_DELAY + 100)
      })

      // Verify "Saved" is showing
      expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saved")

      // Advance time past saved indicator duration
      await act(async () => {
        vi.advanceTimersByTime(SAVED_INDICATOR_DURATION + 100)
      })

      // Indicator should be hidden
      expect(screen.queryByTestId("save-indicator")).not.toBeInTheDocument()
    })

    it("does not show indicator when no changes have been made", () => {
      render(<EntryEditor date="2024-01-15" />)

      // No indicator should be visible initially
      expect(screen.queryByTestId("save-indicator")).not.toBeInTheDocument()
    })
  })

  describe("keyboard shortcuts", () => {
    it("calls onSubmit when Cmd+Enter is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onSubmit = vi.fn()

      render(<EntryEditor date="2024-01-15" onSubmit={onSubmit} />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test content")
      await user.keyboard("{Meta>}{Enter}{/Meta}")

      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("calls onSubmit when Ctrl+Enter is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onSubmit = vi.fn()

      render(<EntryEditor date="2024-01-15" onSubmit={onSubmit} />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test content")
      await user.keyboard("{Control>}{Enter}{/Control}")

      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("does not call onSubmit when just Enter is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onSubmit = vi.fn()

      render(<EntryEditor date="2024-01-15" onSubmit={onSubmit} />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test content{Enter}")

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it("does not crash when onSubmit is not provided", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(<EntryEditor date="2024-01-15" />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      await user.type(textarea, "Test content")

      // Should not throw when pressing Cmd+Enter without onSubmit
      await expect(user.keyboard("{Meta>}{Enter}{/Meta}")).resolves.not.toThrow()
    })
  })
})
