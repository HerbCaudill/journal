import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EntryEditor } from "./EntryEditor"
import * as JournalContext from "../context/JournalContext"
import type { JournalDoc } from "../types/journal"
import type { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge"

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
      vi.advanceTimersByTime(600)
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
})
