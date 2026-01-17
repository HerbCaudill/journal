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

      // Button should be disabled during loading (spinner shown inside button)
      expect(screen.getByRole("button", { name: /ask claude/i })).toBeDisabled()
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

    it("displays assistant and follow-up user messages (first user message is shown by DayView)", () => {
      // First user message is skipped because it's the journal entry shown by DayView
      const messages: Message[] = [
        { id: "1", role: "user", content: "Initial entry", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Assistant message", createdAt: Date.now() },
        { id: "3", role: "user", content: "Follow-up message", createdAt: Date.now() },
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

      // First user message is NOT shown (displayed by DayView)
      expect(screen.queryByText("Initial entry")).not.toBeInTheDocument()
      expect(screen.getByText("Assistant message")).toBeInTheDocument()
      expect(screen.getByText("Follow-up message")).toBeInTheDocument()
    })

    it("styles assistant messages with muted background and user messages with no background", () => {
      // Note: First user message is not displayed (shown by DayView), so we need a follow-up
      const messages: Message[] = [
        { id: "1", role: "user", content: "Initial entry", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Assistant message", createdAt: Date.now() },
        { id: "3", role: "user", content: "Follow-up question", createdAt: Date.now() },
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

      // User messages should have no background styling (matching original journal entry format)
      const userMessages = screen.getAllByTestId("user-message")
      expect(userMessages).toHaveLength(1) // Only the follow-up, first user skipped
      expect(userMessages[0]).not.toHaveClass("bg-primary/10")
      expect(userMessages[0]).not.toHaveClass("bg-muted")
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
      // Mock send to return response with messages array (as useLLM now does)
      const mockMessages: Message[] = [
        { id: "user-1", role: "user", content: "My entry", createdAt: Date.now() },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Response content",
          createdAt: Date.now(),
        },
      ]
      mockSend.mockResolvedValue({
        content: "Response content",
        success: true,
        messages: mockMessages,
      })

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

    it("calls onConversationStart immediately when user submits", async () => {
      const user = userEvent.setup()
      const onConversationStart = vi.fn()
      mockSend.mockResolvedValue({ content: "Response", success: true })

      render(
        <LLMSection
          entryContent="My journal entry"
          apiKey="test-key"
          provider="claude"
          onConversationStart={onConversationStart}
        />,
      )

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      // onConversationStart should be called immediately, before the response
      expect(onConversationStart).toHaveBeenCalledTimes(1)
    })

    it("does not call onConversationStart when validation fails", async () => {
      const user = userEvent.setup()
      const onConversationStart = vi.fn()

      render(
        <LLMSection
          entryContent="   " // Empty content
          apiKey="test-key"
          provider="claude"
          onConversationStart={onConversationStart}
        />,
      )

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      // onConversationStart should not be called when validation fails
      expect(onConversationStart).not.toHaveBeenCalled()
    })

    it("displays all messages from multi-turn conversation except first user message", () => {
      // First user message is shown by DayView, so LLMSection skips it
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

      const userMessages = screen.getAllByTestId("user-message")
      const assistantMessages = screen.getAllByTestId("assistant-response")
      expect(userMessages).toHaveLength(1) // First user skipped, only second user shown
      expect(assistantMessages).toHaveLength(2)
      // First question is NOT shown (displayed by DayView)
      expect(screen.queryByText("First question")).not.toBeInTheDocument()
      expect(screen.getByText("First response")).toBeInTheDocument()
      expect(screen.getByText("Second question")).toBeInTheDocument()
      expect(screen.getByText("Second response")).toBeInTheDocument()
    })
  })

  describe("error handling", () => {
    it("displays rate limiting error (HTTP 429)", () => {
      // The component displays errors from the useLLM hook's error state
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Rate limit exceeded. Please wait before making another request.",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/rate limit exceeded/i)
    })

    it("displays token limit exceeded error", () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Maximum token limit exceeded. Please shorten your message.",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/maximum token limit exceeded/i)
    })

    it("displays API timeout error", () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Request timed out. Please try again.",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/request timed out/i)
    })

    it("displays network disconnection error", () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Network error. Please check your internet connection.",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/network error/i)
    })

    it("displays invalid API key error", () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Invalid API key. Please check your settings.",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/invalid api key/i)
    })

    it("displays error when API response contains no text content", () => {
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Response contained no text content",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/response contained no text content/i)
    })

    it("displays error when response has success: false without error message", () => {
      // useLLM hook adds a default error message when success is false but no error message provided
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "An unknown error occurred",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.getByRole("alert")).toHaveTextContent(/an unknown error occurred/i)
    })

    it("clears error when a new successful message is sent", () => {
      // Start with an error state
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: "Previous error message",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      const { rerender } = render(
        <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
      )

      expect(screen.getByRole("alert")).toHaveTextContent(/previous error message/i)

      // Simulate successful response clearing the error
      mockUseLLM.mockReturnValue({
        messages: [
          { id: "1", role: "user", content: "Test", createdAt: Date.now() },
          { id: "2", role: "assistant", content: "Response", createdAt: Date.now() },
        ],
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      rerender(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("displays error for follow-up message failure", async () => {
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

      mockSend.mockResolvedValue({
        content: "",
        success: false,
        error: "Failed to send follow-up message",
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "Follow-up question")
      await user.click(screen.getByRole("button", { name: /send follow-up/i }))

      // The error will be set via the useLLM hook, so we need to rerender with error
      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: "Failed to send follow-up message",
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      // Force rerender to pick up error state
      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/failed to send follow-up message/i)
      })
    })

    it("restores follow-up input on send failure", async () => {
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

      // Simulate a failed send that should restore the input
      mockSend.mockResolvedValue({
        content: "",
        success: false,
        error: "Network error",
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      await user.type(input, "My important message")
      await user.click(screen.getByRole("button", { name: /send follow-up/i }))

      // The input should be restored after failed send
      await waitFor(() => {
        expect(input).toHaveValue("My important message")
      })
    })
  })

  describe("edge cases", () => {
    it("handles very long entry content gracefully", async () => {
      const user = userEvent.setup()
      const longContent = "a".repeat(50000) // 50KB of content
      mockSend.mockResolvedValue({ content: "Response to long entry", success: true })

      render(<LLMSection entryContent={longContent} apiKey="test-key" provider="claude" />)

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      expect(mockSend).toHaveBeenCalledWith(longContent)
    })

    it("handles special characters in entry content", async () => {
      const user = userEvent.setup()
      const specialContent = "Test <script>alert('xss')</script> & \"quotes\" 'apostrophes'"
      mockSend.mockResolvedValue({ content: "Response", success: true })

      render(<LLMSection entryContent={specialContent} apiKey="test-key" provider="claude" />)

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      expect(mockSend).toHaveBeenCalledWith(specialContent)
    })

    it("handles unicode and emoji content", async () => {
      const user = userEvent.setup()
      const unicodeContent = "Today was great! 🎉 日本語 العربية"
      mockSend.mockResolvedValue({ content: "Response", success: true })

      render(<LLMSection entryContent={unicodeContent} apiKey="test-key" provider="claude" />)

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      expect(mockSend).toHaveBeenCalledWith(unicodeContent)
    })

    it("prevents double submission during loading", async () => {
      const user = userEvent.setup()

      // Set loading state
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: true,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const button = screen.getByRole("button", { name: /ask claude/i })
      expect(button).toBeDisabled()

      // Attempt to click disabled button
      await user.click(button)

      // mockSend should not be called when button is disabled
      // (the test here verifies the button state, user interaction with disabled button is prevented by DOM)
      expect(button).toBeDisabled()
    })

    it("handles rapid follow-up submissions correctly", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      let sendCallCount = 0
      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      // First send succeeds
      mockSend.mockImplementation(async () => {
        sendCallCount++
        return { content: `Response ${sendCallCount}`, success: true }
      })

      render(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      const input = screen.getByRole("textbox", { name: /follow-up message/i })

      // Type and send first message
      await user.type(input, "First message")
      await user.click(screen.getByRole("button", { name: /send follow-up/i }))

      expect(mockSend).toHaveBeenCalledWith("First message")
    })

    it("handles component unmount during pending request gracefully", async () => {
      const user = userEvent.setup()

      // Create a promise that we can control
      let resolvePromise: (value: LLMResponse) => void
      const pendingPromise = new Promise<LLMResponse>(resolve => {
        resolvePromise = resolve
      })
      mockSend.mockReturnValue(pendingPromise)

      const { unmount } = render(
        <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
      )

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      // Unmount while request is pending
      unmount()

      // Resolve the promise after unmount - should not throw
      resolvePromise!({ content: "Response", success: true })

      // No error should be thrown
    })

    it("handles entry content that is only whitespace with various characters", async () => {
      const user = userEvent.setup()

      render(
        <LLMSection
          entryContent={"   \n\t  "} // tabs, newlines
          apiKey="test-key"
          provider="claude"
        />,
      )

      await user.click(screen.getByRole("button", { name: /ask claude/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /please write something in your journal first/i,
        )
      })
      expect(mockSend).not.toHaveBeenCalled()
    })

    it("displays messages with whitespace-only content correctly", () => {
      // Edge case: what if an assistant message somehow has only whitespace?
      // The component should still render it
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "   ", createdAt: Date.now() },
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

      // The assistant response container should still be rendered
      const assistantResponse = screen.getByTestId("assistant-response")
      expect(assistantResponse).toBeInTheDocument()
    })

    it("handles messages array being empty after having messages (conversation reset)", () => {
      // First render with messages
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi!", createdAt: Date.now() },
      ]

      mockUseLLM.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      const { rerender } = render(
        <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
      )

      expect(screen.getByText("Hi!")).toBeInTheDocument()

      // Now simulate conversation reset
      mockUseLLM.mockReturnValue({
        messages: [],
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      rerender(<LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />)

      // Should show the initial submit button again
      expect(screen.getByRole("button", { name: /ask claude/i })).toBeInTheDocument()
      expect(screen.queryByText("Hi!")).not.toBeInTheDocument()
    })
  })

  describe("state transitions", () => {
    describe("API key removal mid-conversation", () => {
      it("hides follow-up input when API key is removed mid-conversation", () => {
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

        const { rerender } = render(
          <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
        )

        // Follow-up input should be visible
        expect(screen.getByRole("textbox", { name: /follow-up message/i })).toBeInTheDocument()

        // Remove the API key
        rerender(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

        // Follow-up input should be hidden, but conversation should still be visible
        expect(
          screen.queryByRole("textbox", { name: /follow-up message/i }),
        ).not.toBeInTheDocument()
        expect(screen.getByText("Hi there!")).toBeInTheDocument()
        // Should show the API key prompt
        expect(screen.getByText(/please add your api key/i)).toBeInTheDocument()
      })

      it("disables submit button when API key is removed before initial submission", () => {
        const { rerender } = render(
          <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
        )

        // Submit button should be enabled
        expect(screen.getByRole("button", { name: /ask claude/i })).toBeEnabled()

        // Remove the API key
        rerender(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

        // Submit button should be disabled
        expect(screen.getByRole("button", { name: /ask claude/i })).toBeDisabled()
      })

      it("shows API key prompt when key is removed after conversation started", () => {
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

        const { rerender } = render(
          <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
        )

        // Remove the API key
        rerender(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

        // Should show both the conversation and the API key prompt
        expect(screen.getByText("Hi there!")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument()
      })

      it("re-enables follow-up input when API key is restored", () => {
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

        const { rerender } = render(
          <LLMSection entryContent="Test entry" apiKey="test-key" provider="claude" />,
        )

        // Remove the API key
        rerender(<LLMSection entryContent="Test entry" apiKey="" provider="claude" />)

        // Follow-up input should be hidden
        expect(
          screen.queryByRole("textbox", { name: /follow-up message/i }),
        ).not.toBeInTheDocument()

        // Restore the API key
        rerender(<LLMSection entryContent="Test entry" apiKey="new-key" provider="claude" />)

        // Follow-up input should be visible again
        expect(screen.getByRole("textbox", { name: /follow-up message/i })).toBeInTheDocument()
      })
    })

    describe("rapid input changes", () => {
      it("handles rapid entry content changes correctly", async () => {
        const user = userEvent.setup()
        mockSend.mockResolvedValue({ content: "Response", success: true })

        const { rerender } = render(
          <LLMSection entryContent="Initial" apiKey="test-key" provider="claude" />,
        )

        // Change entry content rapidly
        rerender(<LLMSection entryContent="Second" apiKey="test-key" provider="claude" />)
        rerender(<LLMSection entryContent="Third" apiKey="test-key" provider="claude" />)
        rerender(<LLMSection entryContent="Final content" apiKey="test-key" provider="claude" />)

        // Submit should send the latest content
        await user.click(screen.getByRole("button", { name: /ask claude/i }))

        expect(mockSend).toHaveBeenCalledWith("Final content")
      })
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

    it("sends follow-up message when Cmd+Enter is pressed", async () => {
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
      await user.keyboard("{Meta>}{Enter}{/Meta}")

      expect(mockSend).toHaveBeenCalledWith("What do you think?")
    })

    it("sends follow-up message when Ctrl+Enter is pressed", async () => {
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
      await user.keyboard("{Control>}{Enter}{/Control}")

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

      // Mock send to return the updated messages array (as useLLM now does)
      const updatedMessages: Message[] = [
        ...messages,
        { id: "3", role: "user", content: "Follow-up question", createdAt: 2000 },
        { id: "4", role: "assistant", content: "Follow-up response", createdAt: 2001 },
      ]
      mockSend.mockResolvedValue({
        content: "Follow-up response",
        success: true,
        messages: updatedMessages,
      })

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

    it("shows user message as read-only in conversation while loading (optimistic update)", () => {
      // Simulate the state after a follow-up was submitted but before the response arrives
      // The user's follow-up message should be visible as a read-only message
      // Note: First user message is not displayed (shown by DayView)
      const messages: Message[] = [
        { id: "1", role: "user", content: "First question", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "First response", createdAt: Date.now() },
        { id: "3", role: "user", content: "Follow-up question", createdAt: Date.now() },
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

      // The user's follow-up should be visible as a read-only message in the conversation
      // First user message is skipped (shown by DayView)
      const userMessages = screen.getAllByTestId("user-message")
      expect(userMessages).toHaveLength(1) // Only follow-up question, first user skipped
      expect(screen.getByText("Follow-up question")).toBeInTheDocument()

      // The input should be empty and disabled (not containing the user's message)
      const input = screen.getByRole("textbox", { name: /follow-up message/i })
      expect(input).toHaveValue("")
      expect(input).toBeDisabled()
    })
  })
})
