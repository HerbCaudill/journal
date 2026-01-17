import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DayView } from "./DayView"
import * as JournalContext from "../context/JournalContext"
import * as GeolocationHook from "../hooks/useGeolocation"
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

// Mock the useGeolocation hook
vi.mock("../hooks/useGeolocation", async () => {
  const actual = await vi.importActual("../hooks/useGeolocation")
  return {
    ...actual,
    useGeolocation: vi.fn(),
  }
})

// Mock the useLLM hook (used by LLMSection)
vi.mock("../hooks/useLLM", () => ({
  useLLM: vi.fn(() => ({
    messages: [],
    isLoading: false,
    error: null,
    send: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
    reset: vi.fn(),
    setMessages: vi.fn(),
  })),
}))

// Mock the useGoogleCalendar hook
vi.mock("../hooks/useGoogleCalendar", () => ({
  useGoogleCalendar: vi.fn(() => ({
    authState: "unconfigured",
    isLoading: false,
    error: null,
    events: [],
    authenticate: vi.fn(),
    fetchEvents: vi.fn(),
    clearError: vi.fn(),
  })),
}))

const mockUseJournal = vi.mocked(JournalContext.useJournal)
const mockUseGeolocation = vi.mocked(GeolocationHook.useGeolocation)

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

    // Default geolocation mock - supported with "prompt" permission
    mockUseGeolocation.mockReturnValue({
      position: null,
      isLoading: false,
      error: null,
      permission: "prompt",
      requestPosition: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
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
        llmProvider: "claude" as const,
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

  describe("Claude integration", () => {
    it("renders the Ask Claude button", () => {
      render(<DayView date="2024-01-15" />)

      const askClaudeButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askClaudeButton).toBeInTheDocument()
    })

    it("disables Ask Claude button when no API key is configured", () => {
      render(<DayView date="2024-01-15" />)

      const askClaudeButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askClaudeButton).toBeDisabled()
    })

    it("shows message to configure API key when not set", () => {
      render(<DayView date="2024-01-15" />)

      expect(screen.getByText(/add your API key/i)).toBeInTheDocument()
    })

    it("enables Ask Claude button when API key is configured", () => {
      const docWithApiKey = {
        entries: {},
        settings: {
          displayName: "",
          timezone: "UTC",
          theme: "system" as const,
          llmProvider: "claude" as const,
          claudeApiKey: "sk-ant-test123",
        },
      } as Doc<JournalDoc>

      mockUseJournal.mockReturnValue({
        doc: docWithApiKey,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date="2024-01-15" />)

      const askClaudeButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askClaudeButton).not.toBeDisabled()
    })

    it("displays Claude's responses when present in entry", async () => {
      const { useLLM } = await import("../hooks/useLLM")
      vi.mocked(useLLM).mockReturnValue({
        messages: [
          {
            id: "msg-1",
            role: "assistant",
            content: "This is Claude's response",
            createdAt: Date.now(),
          },
        ],
        isLoading: false,
        error: null,
        send: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
        reset: vi.fn(),
        setMessages: vi.fn(),
      })

      const docWithApiKey = {
        entries: {
          "2024-01-15": {
            id: "entry-1",
            date: "2024-01-15",
            messages: [
              {
                id: "user-1",
                role: "user" as const,
                content: "My journal entry",
                createdAt: Date.now(),
              },
              {
                id: "assistant-1",
                role: "assistant" as const,
                content: "This is Claude's response",
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
          claudeApiKey: "sk-ant-test123",
        },
      } as Doc<JournalDoc>

      mockUseJournal.mockReturnValue({
        doc: docWithApiKey,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date="2024-01-15" />)

      expect(screen.getByText("This is Claude's response")).toBeInTheDocument()
    })
  })

  describe("Location capture", () => {
    it("renders the Capture location button when geolocation is supported", () => {
      render(<DayView date="2024-01-15" />)

      const captureButton = screen.getByRole("button", { name: /capture location/i })
      expect(captureButton).toBeInTheDocument()
      expect(captureButton).toHaveTextContent("Capture location")
    })

    it("does not render the button when geolocation is unavailable", () => {
      mockUseGeolocation.mockReturnValue({
        position: null,
        isLoading: false,
        error: null,
        permission: "unavailable",
        requestPosition: vi.fn().mockResolvedValue(null),
        clear: vi.fn(),
      })

      render(<DayView date="2024-01-15" />)

      expect(screen.queryByRole("button", { name: /capture location/i })).not.toBeInTheDocument()
    })

    it("does not render the button when entry already has a position", () => {
      const docWithPosition = {
        entries: {
          "2024-01-15": {
            id: "entry-1",
            date: "2024-01-15",
            messages: [],
            position: {
              latitude: 41.8781,
              longitude: -87.6298,
              timestamp: Date.now(),
            },
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
        doc: docWithPosition,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date="2024-01-15" />)

      expect(screen.queryByRole("button", { name: /capture location/i })).not.toBeInTheDocument()
    })

    it("shows loading state while capturing location", () => {
      mockUseGeolocation.mockReturnValue({
        position: null,
        isLoading: true,
        error: null,
        permission: "prompt",
        requestPosition: vi.fn().mockResolvedValue(null),
        clear: vi.fn(),
      })

      render(<DayView date="2024-01-15" />)

      const captureButton = screen.getByRole("button", { name: /capture location/i })
      expect(captureButton).toHaveTextContent("Getting location...")
      expect(captureButton).toBeDisabled()
    })

    it("disables button when permission is denied", () => {
      mockUseGeolocation.mockReturnValue({
        position: null,
        isLoading: false,
        error: null,
        permission: "denied",
        requestPosition: vi.fn().mockResolvedValue(null),
        clear: vi.fn(),
      })

      render(<DayView date="2024-01-15" />)

      const captureButton = screen.getByRole("button", { name: /capture location/i })
      expect(captureButton).toBeDisabled()
      expect(screen.getByText("Location permission denied")).toBeInTheDocument()
    })

    it("shows error message when location capture fails", () => {
      mockUseGeolocation.mockReturnValue({
        position: null,
        isLoading: false,
        error: "Location information unavailable",
        permission: "granted",
        requestPosition: vi.fn().mockResolvedValue(null),
        clear: vi.fn(),
      })

      render(<DayView date="2024-01-15" />)

      expect(screen.getByText("Location information unavailable")).toBeInTheDocument()
    })

    it("calls requestPosition and saves position on button click", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const mockPosition = {
        latitude: 41.8781,
        longitude: -87.6298,
        accuracy: 10,
        timestamp: 1705276800000,
      }
      const mockRequestPosition = vi.fn().mockResolvedValue(mockPosition)

      mockUseGeolocation.mockReturnValue({
        position: null,
        isLoading: false,
        error: null,
        permission: "prompt",
        requestPosition: mockRequestPosition,
        clear: vi.fn(),
      })

      render(<DayView date="2024-01-15" />)

      const captureButton = screen.getByRole("button", { name: /capture location/i })
      await user.click(captureButton)

      expect(mockRequestPosition).toHaveBeenCalledTimes(1)
      expect(mockChangeDoc).toHaveBeenCalled()

      // Verify the changeDoc callback sets the position correctly
      const changeDocCallback = mockChangeDoc.mock.calls[0][0]
      const testDoc = {
        entries: {},
      } as JournalDoc
      changeDocCallback(testDoc)

      expect(testDoc.entries["2024-01-15"].position).toEqual(mockPosition)
    })

    it("does not save position when requestPosition returns null", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const mockRequestPosition = vi.fn().mockResolvedValue(null)

      mockUseGeolocation.mockReturnValue({
        position: null,
        isLoading: false,
        error: null,
        permission: "prompt",
        requestPosition: mockRequestPosition,
        clear: vi.fn(),
      })

      render(<DayView date="2024-01-15" />)

      const captureButton = screen.getByRole("button", { name: /capture location/i })
      await user.click(captureButton)

      expect(mockRequestPosition).toHaveBeenCalledTimes(1)
      expect(mockChangeDoc).not.toHaveBeenCalled()
    })
  })
})
