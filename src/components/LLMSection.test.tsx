import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LLMSection } from "./LLMSection"
import * as useLLMHook from "../hooks/useLLM"
import type { Message } from "../types/journal"
import type { LLMResponse } from "../lib/llm/types"

// Mock the useLLM hook
vi.mock("../hooks/useLLM", () => ({
  useLLM: vi.fn(),
}))

const mockUseLLM = vi.mocked(useLLMHook.useLLM)

describe("LLMSection", () => {
  const mockSend = vi.fn<(content: string) => Promise<LLMResponse>>()
  const mockReset = vi.fn<() => void>()
  const mockSetMessages = vi.fn<(messages: Message[]) => void>()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseLLM.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })
  })

  describe("with Claude provider", () => {
    it("renders the Ask Claude button", () => {
      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("button", { name: /ask claude/i })).toBeInTheDocument()
    })

    it("shows Claude-specific API key message when no API key is provided", () => {
      render(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

      expect(screen.getByText(/to use claude, please add your api key/i)).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "#/settings")
    })

    it("does not show text label while idle", () => {
      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.queryByText("Ask Claude")).not.toBeInTheDocument()
    })
  })

  describe("with OpenAI provider", () => {
    it("renders the Ask AI button", () => {
      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="openai" />)

      expect(screen.getByRole("button", { name: /ask ai/i })).toBeInTheDocument()
    })

    it("shows AI-specific API key message when no API key is provided", () => {
      render(<LLMSection entryContent="Test entry" apiKey="" provider="openai" />)

      expect(screen.getByText(/to use ai, please add your api key/i)).toBeInTheDocument()
    })

    it("does not show text label while idle", () => {
      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="openai" />)

      expect(screen.queryByText("Ask AI")).not.toBeInTheDocument()
    })
  })

  describe("common behavior", () => {
    it("disables submit button when no API key is provided", () => {
      render(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

      expect(screen.getByRole("button", { name: /ask claude/i })).toBeDisabled()
    })

    it("shows error when trying to submit empty entry", async () => {
      const user = userEvent.setup()

      render(<LLMSection entryContent="   " apiKey="test-key" provider="claude" />)

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      expect(screen.getByRole("alert")).toHaveTextContent(
        /please write something in your journal first/i,
      )
      expect(mockSend).not.toHaveBeenCalled()
    })

    it("calls send with entry content when button is clicked", async () => {
      const user = userEvent.setup()
      mockSend.mockResolvedValue({ content: "Response", success: true })

      render(<LLMSection entryContent="My journal entry" apiKey="test-key" provider="claude" />)

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      expect(mockSend).toHaveBeenCalledWith("My journal entry")
    })

    it("shows loading state while sending", async () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: true,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("button", { name: /ask claude/i })).toBeDisabled()
      expect(screen.getByText(/thinking/i)).toBeInTheDocument()
    })

    it("displays assistant responses", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        {
          id: "2",
          role: "assistant",
          content: "Hi there! How can I help?",
          createdAt: Date.now(),
        },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByText("Hi there! How can I help?")).toBeInTheDocument()
    })

    it("displays only assistant messages, not user messages", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "User message", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Assistant message", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.queryByText("User message")).not.toBeInTheDocument()
      expect(screen.getByText("Assistant message")).toBeInTheDocument()
    })

    it("styles assistant messages with muted background", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "User message", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Assistant message", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const assistantMessages = screen.getAllByTestId("assistant-response")
      expect(assistantMessages).toHaveLength(1)
      expect(assistantMessages[0]).toHaveClass("bg-muted")
    })

    it("displays API error from useLLM", () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "API rate limited",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent("API rate limited")
    })

    it("calls onMessagesChange callback when messages are updated", async () => {
      const user = userEvent.setup()
      const onMessagesChange = vi.fn()
      mockSend.mockResolvedValue({ content: "Response content", success: true })

      render(
        <LLMSection
          entryContent="My entry"
          apiKey="test-key"
          provider="claude"
          onMessagesChange={onMessagesChange}
        />,
      )

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      await waitFor(() => {
        expect(onMessagesChange).toHaveBeenCalled()
      })

      const callArgs = onMessagesChange.mock.calls[0][0] as Message[]
      expect(callArgs).toHaveLength(2)
      expect(callArgs[0].role).toBe("user")
      expect(callArgs[0].content).toBe("My entry")
      expect(callArgs[1].role).toBe("assistant")
      expect(callArgs[1].content).toBe("Response content")
    })

    it("initializes with provided initial messages and provider", () => {
      const initialMessages: Message[] = [
        { id: "1", role: "user", content: "Previous", createdAt: 1000 },
        { id: "2", role: "assistant", content: "Previous response", createdAt: 1001 },
      ]

      render(
        <LLMSection
          entryContent="Test entry"
          apiKey="test-key"
          provider="claude"
          initialMessages={initialMessages}
        />,
      )

      expect(mockUseLLM).toHaveBeenCalledWith({
        provider: "claude",
        apiKey: "test-key",
        initialMessages,
      })
    })

    it("displays only assistant responses from multi-turn conversation", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "First question", createdAt: 1000 },
        { id: "2", role: "assistant", content: "First response", createdAt: 1001 },
        { id: "3", role: "user", content: "Second question", createdAt: 2000 },
        { id: "4", role: "assistant", content: "Second response", createdAt: 2001 },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const assistantMessages = screen.getAllByTestId("assistant-response")
      expect(assistantMessages).toHaveLength(2)
      expect(screen.queryByText("First question")).not.toBeInTheDocument()
      expect(screen.getByText("First response")).toBeInTheDocument()
      expect(screen.queryByText("Second question")).not.toBeInTheDocument()
      expect(screen.getByText("Second response")).toBeInTheDocument()
    })
  })

  describe("follow-up messages", () => {
    it("shows follow-up input after initial conversation", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("textbox", { name: /follow-up message/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeInTheDocument()
    })

    it("does not show follow-up input when there are no messages", () => {
      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.queryByRole("textbox", { name: /follow-up message/i })).not.toBeInTheDocument()
    })

    it("does not show follow-up input without API key", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

      expect(screen.queryByRole("textbox", { name: /follow-up message/i })).not.toBeInTheDocument()
    })

    it("disables follow-up input while loading", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: true,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("textbox", { name: /follow-up message/i })).toBeDisabled()
      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeDisabled()
    })

    it("sends follow-up message when send button is clicked", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "What do you think?")
      await user.click(screen.getByRole("button", { name: /send follow-up/i }))

      expect(mockSend).toHaveBeenCalledWith("What do you think?")
    })

    it("sends follow-up message when Enter is pressed", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "What do you think?{enter}")

      expect(mockSend).toHaveBeenCalledWith("What do you think?")
    })

    it("clears follow-up input after sending", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "What do you think?")
      await user.click(screen.getByRole("button", { name: /send follow-up/i }))

      await waitFor(() => {
        expect(input).toHaveValue("")
      })
    })

    it("disables send button when input is empty", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeDisabled()
    })

    it("does not send follow-up when input is only whitespace", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "   ")

      // Button should be disabled for whitespace-only input
      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeDisabled()
    })

    it("calls onMessagesChange with updated messages after follow-up", async () => {
      const user = userEvent.setup()
      const onMessagesChange = vi.fn()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: 1000 },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: 1001 },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(
        <LLMSection
          entryContent="Test entry"
          apiKey="test-key"
          provider="claude"
          onMessagesChange={onMessagesChange}
        />,
      )

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "Follow-up question")
      await user.click(screen.getByRole("button", { name: /send follow-up/i }))

      await waitFor(() => {
        expect(onMessagesChange).toHaveBeenCalled()
      })

      const callArgs = onMessagesChange.mock.calls[0][0] as Message[]
      expect(callArgs).toHaveLength(4)
      expect(callArgs[2].role).toBe("user")
      expect(callArgs[2].content).toBe("Follow-up question")
      expect(callArgs[3].role).toBe("assistant")
      expect(callArgs[3].content).toBe("Follow-up response")
    })

    it("auto-focuses follow-up input when response is received", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      expect(document.activeElement).toBe(input)
    })

    it("does not auto-focus when loading", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: true,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      expect(document.activeElement).not.toBe(input)
    })
  })
})
