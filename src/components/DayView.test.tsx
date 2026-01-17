import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as JournalContext from "../context/JournalContext"
import type { JournalDoc } from "../types/journal"
import { toDateString } from "../types/journal"
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
    editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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
    render(<DayView date={toDateString("2024-01-15")} />)

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

    render(<DayView date={toDateString("2024-06-20")} />)

    const textarea = screen.getByRole("textbox", { name: /journal entry/i })
    expect(textarea).toHaveValue("Content for June 20")
  })

  describe("Claude integration", () => {
    it("renders the Ask Claude button", () => {
      render(<DayView date={toDateString("2024-01-15")} />)

      const askClaudeButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askClaudeButton).toBeInTheDocument()
    })

    it("disables Ask Claude button when no API key is configured", () => {
      render(<DayView date={toDateString("2024-01-15")} />)

      const askClaudeButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askClaudeButton).toBeDisabled()
    })

    it("shows message to configure API key when not set", () => {
      render(<DayView date={toDateString("2024-01-15")} />)

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

      render(<DayView date={toDateString("2024-01-15")} />)

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
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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

      render(<DayView date={toDateString("2024-01-15")} />)

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
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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

      render(<DayView date={toDateString("2024-01-15")} />)

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

      render(<DayView date={toDateString("2024-01-15")} />)

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

      render(<DayView date={toDateString("2024-01-15")} />)

      // EntryEditor should be rendered when there are no messages
      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
    })

    it("shows Edit button when conversation has started", async () => {
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
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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

      render(<DayView date={toDateString("2024-01-15")} />)

      // Edit button should be visible
      const editButton = screen.getByRole("button", { name: /edit journal entry/i })
      expect(editButton).toBeInTheDocument()
    })

    it("does not show Edit button when no conversation has started", () => {
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

      render(<DayView date={toDateString("2024-01-15")} />)

      // Edit button should NOT be visible when there's no conversation
      const editButton = screen.queryByRole("button", { name: /edit journal entry/i })
      expect(editButton).not.toBeInTheDocument()
    })

    it("shows EntryEditor when Edit button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
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
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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

      render(<DayView date={toDateString("2024-01-15")} />)

      // Initially, EntryEditor should NOT be visible
      expect(screen.queryByRole("textbox", { name: /journal entry/i })).not.toBeInTheDocument()

      // Click the Edit button
      const editButton = screen.getByRole("button", { name: /edit journal entry/i })
      await user.click(editButton)

      // Now EntryEditor should be visible
      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue("My journal entry")
    })

    it("hides EntryEditor when Done button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
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
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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

      render(<DayView date={toDateString("2024-01-15")} />)

      // Click the Edit button to enter edit mode
      const editButton = screen.getByRole("button", { name: /edit journal entry/i })
      await user.click(editButton)

      // EntryEditor should be visible
      expect(screen.getByRole("textbox", { name: /journal entry/i })).toBeInTheDocument()

      // Click the Done button
      const doneButton = screen.getByRole("button", { name: /done editing/i })
      await user.click(doneButton)

      // EntryEditor should be hidden again
      expect(screen.queryByRole("textbox", { name: /journal entry/i })).not.toBeInTheDocument()
      // Edit button should be visible again
      expect(screen.getByRole("button", { name: /edit journal entry/i })).toBeInTheDocument()
    })

    it("hides Edit button while in edit mode", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
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
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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

      render(<DayView date={toDateString("2024-01-15")} />)

      // Click the Edit button to enter edit mode
      const editButton = screen.getByRole("button", { name: /edit journal entry/i })
      await user.click(editButton)

      // Edit button should be hidden while in edit mode
      expect(screen.queryByRole("button", { name: /edit journal entry/i })).not.toBeInTheDocument()
      // Done button should be visible
      expect(screen.getByRole("button", { name: /done editing/i })).toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    describe("first-time user (no entries)", () => {
      it("shows empty EntryEditor for completely new user", () => {
        // Mock has empty entries by default
        render(<DayView date={toDateString("2024-01-15")} />)

        const textarea = screen.getByRole("textbox", { name: /journal entry/i })
        expect(textarea).toBeInTheDocument()
        expect(textarea).toHaveValue("")
      })

      it("shows Ask Claude button for new user without API key", () => {
        render(<DayView date={toDateString("2024-01-15")} />)

        const button = screen.getByRole("button", { name: /ask claude/i })
        expect(button).toBeInTheDocument()
        expect(button).toBeDisabled() // Should be disabled without API key
      })

      it("shows API key configuration prompt for new user", () => {
        render(<DayView date={toDateString("2024-01-15")} />)

        expect(screen.getByText(/add your API key/i)).toBeInTheDocument()
      })

      it("handles new user navigating to any date", () => {
        render(<DayView date={toDateString("2030-06-15")} />)

        const textarea = screen.getByRole("textbox", { name: /journal entry/i })
        expect(textarea).toBeInTheDocument()
        expect(textarea).toHaveValue("")
      })
    })

    describe("entry with empty messages", () => {
      it("shows EntryEditor when entry exists but has empty messages array", () => {
        const docWithEmptyMessages = {
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
          doc: docWithEmptyMessages,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<DayView date={toDateString("2024-01-15")} />)

        const textarea = screen.getByRole("textbox", { name: /journal entry/i })
        expect(textarea).toBeInTheDocument()
        expect(textarea).toHaveValue("")
      })

      it("does not show Edit button when messages array is empty", () => {
        const docWithEmptyMessages = {
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
          doc: docWithEmptyMessages,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<DayView date={toDateString("2024-01-15")} />)

        expect(
          screen.queryByRole("button", { name: /edit journal entry/i }),
        ).not.toBeInTheDocument()
      })
    })

    describe("no API key configured", () => {
      it("disables submit button when no Claude API key", () => {
        const docWithoutApiKey = {
          entries: {},
          settings: {
            displayName: "",
            timezone: "UTC",
            theme: "system" as const,
            llmProvider: "claude" as const,
            // claudeApiKey is intentionally missing
          },
        } as Doc<JournalDoc>

        mockUseJournal.mockReturnValue({
          doc: docWithoutApiKey,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<DayView date={toDateString("2024-01-15")} />)

        const button = screen.getByRole("button", { name: /ask claude/i })
        expect(button).toBeDisabled()
      })

      it("shows API key prompt when switching providers without configured key", () => {
        // User has Claude API key but not OpenAI
        const docWithClaudeOnly = {
          entries: {},
          settings: {
            displayName: "",
            timezone: "UTC",
            theme: "system" as const,
            llmProvider: "openai" as const, // Using OpenAI
            claudeApiKey: "sk-ant-test123", // But only Claude key configured
            // openaiApiKey is missing
          },
        } as Doc<JournalDoc>

        mockUseJournal.mockReturnValue({
          doc: docWithClaudeOnly,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<DayView date={toDateString("2024-01-15")} />)

        expect(screen.getByText(/add your API key/i)).toBeInTheDocument()
      })
    })

    describe("conversation cleared/reset", () => {
      it("shows EntryEditor after conversation is cleared", () => {
        // Start with messages, then rerender without
        const docWithMessages = {
          entries: {
            "2024-01-15": {
              id: "entry-1",
              date: "2024-01-15",
              messages: [
                {
                  id: "user-1",
                  role: "user" as const,
                  content: "My entry",
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
          doc: docWithMessages,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        const { rerender } = render(<DayView date={toDateString("2024-01-15")} />)

        // Entry editor should be visible initially
        expect(screen.getByRole("textbox", { name: /journal entry/i })).toBeInTheDocument()

        // Now simulate conversation being cleared
        const docWithClearedMessages = {
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
          doc: docWithClearedMessages,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        rerender(<DayView date={toDateString("2024-01-15")} />)

        // Entry editor should still be visible with empty content
        const textarea = screen.getByRole("textbox", { name: /journal entry/i })
        expect(textarea).toBeInTheDocument()
        expect(textarea).toHaveValue("")
      })
    })
  })

  describe("error handling", () => {
    it("handles undefined doc gracefully", () => {
      mockUseJournal.mockReturnValue({
        doc: undefined,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      // Should not crash when doc is undefined
      render(<DayView date={toDateString("2024-01-15")} />)

      // Component should render with empty state
      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue("")
    })

    it("handles null settings gracefully", () => {
      const docWithNullSettings = {
        entries: {},
        settings: null,
      } as unknown as Doc<JournalDoc>

      mockUseJournal.mockReturnValue({
        doc: docWithNullSettings,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      // Should not crash when settings is null
      render(<DayView date={toDateString("2024-01-15")} />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
    })

    // Note: Test for handling entry with undefined messages is tracked as bug j-61j
    // Currently the component crashes in this scenario

    it("handles missing LLM provider setting gracefully", () => {
      const docWithoutProvider = {
        entries: {},
        settings: {
          displayName: "",
          timezone: "UTC",
          theme: "system" as const,
          // llmProvider is intentionally missing
        },
      } as Doc<JournalDoc>

      mockUseJournal.mockReturnValue({
        doc: docWithoutProvider,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      // Should render with default provider (Claude)
      render(<DayView date={toDateString("2024-01-15")} />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toBeInTheDocument()
      // Ask Claude button should exist (default provider)
      const askButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askButton).toBeInTheDocument()
    })

    it("handles empty string API key correctly", () => {
      const docWithEmptyApiKey = {
        entries: {},
        settings: {
          displayName: "",
          timezone: "UTC",
          theme: "system" as const,
          llmProvider: "claude" as const,
          claudeApiKey: "", // empty string
        },
      } as Doc<JournalDoc>

      mockUseJournal.mockReturnValue({
        doc: docWithEmptyApiKey,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date={toDateString("2024-01-15")} />)

      // Button should be disabled with empty API key
      const askButton = screen.getByRole("button", { name: /ask claude/i })
      expect(askButton).toBeDisabled()
    })
  })

  describe("edge cases", () => {
    it("handles date with only whitespace user message", () => {
      const docWithWhitespaceEntry = {
        entries: {
          "2024-01-15": {
            id: "entry-1",
            date: "2024-01-15",
            messages: [
              {
                id: "msg-1",
                role: "user" as const,
                content: "   ",
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
        doc: docWithWhitespaceEntry,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date={toDateString("2024-01-15")} />)

      // Should show editor with the whitespace content
      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toHaveValue("   ")
    })

    it("handles rapid date changes preserving local state correctly", () => {
      const docWithMultipleEntries = {
        entries: {
          "2024-01-15": {
            id: "entry-1",
            date: "2024-01-15",
            messages: [
              {
                id: "msg-1",
                role: "user" as const,
                content: "Entry for Jan 15",
                createdAt: Date.now(),
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          "2024-01-16": {
            id: "entry-2",
            date: "2024-01-16",
            messages: [
              {
                id: "msg-2",
                role: "user" as const,
                content: "Entry for Jan 16",
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
        doc: docWithMultipleEntries,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { rerender } = render(<DayView date={toDateString("2024-01-15")} />)

      const textarea = screen.getByRole("textbox", { name: /journal entry/i })
      expect(textarea).toHaveValue("Entry for Jan 15")

      // Rapid date changes
      rerender(<DayView date={toDateString("2024-01-16")} />)
      expect(textarea).toHaveValue("Entry for Jan 16")

      rerender(<DayView date={toDateString("2024-01-15")} />)
      expect(textarea).toHaveValue("Entry for Jan 15")

      rerender(<DayView date={toDateString("2024-01-16")} />)
      expect(textarea).toHaveValue("Entry for Jan 16")
    })

    it("resets edit mode when navigating to a new date", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { useLLM } = await import("../hooks/useLLM")
      vi.mocked(useLLM).mockReturnValue({
        messages: [
          {
            id: "msg-1",
            role: "assistant",
            content: "Response",
            createdAt: Date.now(),
          },
        ],
        isLoading: false,
        error: null,
        send: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
        reset: vi.fn(),
        setMessages: vi.fn(),
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
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
                content: "Journal entry",
                createdAt: Date.now(),
              },
              {
                id: "assistant-1",
                role: "assistant" as const,
                content: "Response",
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

      const { rerender } = render(<DayView date={toDateString("2024-01-15")} />)

      // Enter edit mode
      const editButton = screen.getByRole("button", { name: /edit journal entry/i })
      await user.click(editButton)

      // Should be in edit mode
      expect(screen.getByRole("textbox", { name: /journal entry/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /done editing/i })).toBeInTheDocument()

      // Reset the mock for a different date with no conversation
      vi.mocked(useLLM).mockReturnValue({
        messages: [],
        isLoading: false,
        error: null,
        send: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
        reset: vi.fn(),
        setMessages: vi.fn(),
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
      })

      const emptyDoc = {
        entries: {},
        settings: {
          displayName: "",
          timezone: "UTC",
          theme: "system" as const,
          llmProvider: "claude" as const,
        },
      } as Doc<JournalDoc>

      mockUseJournal.mockReturnValue({
        doc: emptyDoc,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      // Navigate to a different date
      rerender(<DayView date={toDateString("2024-01-16")} />)

      // Edit mode should be reset (no Done button should be visible)
      expect(screen.queryByRole("button", { name: /done editing/i })).not.toBeInTheDocument()
    })

    // Note: Test for handling undefined entries object is tracked as bug j-mn1
    // Currently the component crashes in this scenario
  })

  describe("Conversation persistence", () => {
    it("passes follow-up user messages to LLMSection for restoration", async () => {
      // This test verifies that when a conversation with follow-up user messages
      // is saved and reloaded, all messages are passed to LLMSection
      const { useLLM } = await import("../hooks/useLLM")
      vi.mocked(useLLM).mockReturnValue({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "First response",
            createdAt: Date.now(),
          },
          {
            id: "user-followup-1",
            role: "user",
            content: "Follow-up question",
            createdAt: Date.now(),
          },
          {
            id: "assistant-2",
            role: "assistant",
            content: "Second response",
            createdAt: Date.now(),
          },
        ],
        isLoading: false,
        error: null,
        send: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
        reset: vi.fn(),
        setMessages: vi.fn(),
        editAndResend: vi.fn().mockResolvedValue({ content: "Mock response", success: true }),
      })

      const docWithFullConversation = {
        entries: {
          "2024-01-15": {
            id: "entry-1",
            date: "2024-01-15",
            messages: [
              {
                id: "user-1",
                role: "user" as const,
                content: "My journal entry", // First user message (journal entry)
                createdAt: Date.now(),
              },
              {
                id: "assistant-1",
                role: "assistant" as const,
                content: "First response",
                createdAt: Date.now(),
              },
              {
                id: "user-followup-1",
                role: "user" as const,
                content: "Follow-up question", // Follow-up user message
                createdAt: Date.now(),
              },
              {
                id: "assistant-2",
                role: "assistant" as const,
                content: "Second response",
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
        doc: docWithFullConversation,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<DayView date={toDateString("2024-01-15")} />)

      // Both assistant responses should be displayed (via the mock LLMSection)
      expect(screen.getByText("First response")).toBeInTheDocument()
      expect(screen.getByText("Second response")).toBeInTheDocument()

      // Edit button should be visible since conversation has started
      expect(screen.getByRole("button", { name: /edit journal entry/i })).toBeInTheDocument()

      // EntryEditor should be hidden when conversation has started
      expect(screen.queryByRole("textbox", { name: /journal entry/i })).not.toBeInTheDocument()
    })
  })
})
