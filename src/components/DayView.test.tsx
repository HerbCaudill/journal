import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { DayView } from "./DayView"
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

describe("DayView", () => {
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

  it("renders the EntryEditor for the given date", () => {
    render(<DayView date="2024-01-15" />)

    // EntryEditor should be rendered with its textarea
    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    expect(textarea).toBeInTheDocument()
  })

  it("passes the correct date to EntryEditor", () => {
    const docWithEntry = {
      entries: {
        "2024-06-20": {
          id: "entry-1",
          date: "2024-06-20",
          messages: [
            {
              id: "msg-1",
              role: "user" as const,
              content: "Content for June 20",
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

    render(<DayView date="2024-06-20" />)

    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    expect(textarea).toHaveValue("Content for June 20")
  })
})
