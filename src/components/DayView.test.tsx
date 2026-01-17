import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import * as JournalContext from "../context/JournalContext"
import type { JournalDoc } from "../types/journal"
import type { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge"

// Mock the useJournal hook - don't use importActual to avoid loading automerge
vi.mock("../context/JournalContext", () => ({
  useJournal: vi.fn(),
}))

// Import DayView after mocking context
import { DayView } from "./DayView"

// Mock the LLMSection component - the Anthropic SDK import causes memory issues in jsdom
// Note: we use useEffect to call onSubmitButtonProps to avoid infinite render loops
vi.mock("./LLMSection", () => {
  const React = require("react")
  return {
    LLMSection: ({
      apiKey,
      initialMessages,
      onSubmitButtonProps,
    }: {
      entryContent: string
      apiKey: string
      provider: string
      initialMessages: Array<{ id: string; role: string; content: string; createdAt: number }>
      onMessagesChange: (messages: unknown[]) => void
      bio: string
      additionalInstructions: string
      onSubmitButtonProps: (props: {
        onClick: () => void
        disabled: boolean
        isLoading: boolean
        ariaLabel: string
      }) => void
    }) => {
      // Use useEffect to call onSubmitButtonProps to avoid infinite render loops
      React.useEffect(() => {
        if (onSubmitButtonProps) {
          onSubmitButtonProps({
            onClick: () => {},
            disabled: !apiKey,
            isLoading: false,
            ariaLabel: "Ask Claude",
          })
        }
      }, [apiKey, onSubmitButtonProps])

      // Render assistant messages if present
      const assistantMessages =
        initialMessages?.filter((m: { role: string }) => m.role === "assistant") || []
      return (
        <div data-testid="llm-section">
          {assistantMessages.map((m: { id: string; content: string }) => (
            <div key={m.id}>{m.content}</div>
          ))}
          {!apiKey && <span>add your API key</span>}
        </div>
      )
    },
    SubmitButtonIcon: () => null,
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

  // Note: Location capture and display tests have been moved to App.test.tsx
  // since the location logic is now handled at the App level and displayed in the Header

  describe("EntryEditor visibility", () => {
    it("hides EntryEditor when conversation has started (has assistant messages)", async () => {
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

      const docWithConversation = {
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
        doc: docWithConversation,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date="2024-01-15" />)

      // EntryEditor should NOT be rendered when there's a conversation
      const textarea = screen.queryByRole("textbox", { name: /journal entry/i })
      expect(textarea).not.toBeInTheDocument()
    })

    it("shows EntryEditor when there are only user messages (no conversation)", () => {
      const docWithOnlyUserMessage = {
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
        doc: docWithOnlyUserMessage,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date="2024-01-15" />)

      // EntryEditor should be rendered when there's no conversation yet
      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue("My journal entry")
    })

    it("shows EntryEditor when entry has no messages", () => {
      const docWithEmptyEntry = {
        entries: {
          "2024-01-15": {
            id: "entry-1",
            date: "2024-01-15",
            messages: [],
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
        doc: docWithEmptyEntry,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date="2024-01-15" />)

      // EntryEditor should be rendered when there are no messages
      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
    })
  })
})
