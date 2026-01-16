import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClaudeSection } from "./ClaudeSection"
import * as useClaude from "../hooks/useClaude"
import type { Message } from "../types/journal"
import type { ClaudeResponse } from "../lib/claude"

// Mock the useClaude hook
vi.mock("../hooks/useClaude", () => ({
  useClaude: vi.fn(),
}))

const mockUseClaude = vi.mocked(useClaude.useClaude)

describe("ClaudeSection", () => {
  const mockSend = vi.fn<(content: string) => Promise<ClaudeResponse>>()
  const mockReset = vi.fn<() => void>()
  const mockSetMessages = vi.fn<(messages: Message[]) => void>()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseClaude.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })
  })

  it("renders the Ask Claude button", () => {
    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.getByRole("button", { name: /ask claude/i })).toBeInTheDocument()
  })

  it("shows API key message when no API key is provided", () => {
    render(<ClaudeSection entryContent="Test entry" apiKey="" />)

    expect(screen.getByText(/please add your api key/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "#/settings")
  })

  it("disables submit button when no API key is provided", () => {
    render(<ClaudeSection entryContent="Test entry" apiKey="" />)

    expect(screen.getByRole("button", { name: /ask claude/i })).toBeDisabled()
  })

  it("shows error when trying to submit empty entry", async () => {
    const user = userEvent.setup()

    render(<ClaudeSection entryContent="   " apiKey="test-key" />)

    await user.click(screen.getByRole("button", { name: /ask claude/i }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      /please write something in your journal first/i,
    )
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("calls send with entry content when button is clicked", async () => {
    const user = userEvent.setup()
    mockSend.mockResolvedValue({ content: "Response", success: true })

    render(<ClaudeSection entryContent="My journal entry" apiKey="test-key" />)

    await user.click(screen.getByRole("button", { name: /ask claude/i }))

    expect(mockSend).toHaveBeenCalledWith("My journal entry")
  })

  it("shows loading state while sending", async () => {
    mockUseClaude.mockReturnValue({
      messages: [],
      isLoading: true,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.getByRole("button", { name: /ask claude/i })).toBeDisabled()
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })

  it("displays Claude responses", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
      {
        id: "2",
        role: "assistant",
        content: "Hi there! How can I help?",
        createdAt: Date.now(),
      },
    ]

    mockUseClaude.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.getByText("Claude's Response")).toBeInTheDocument()
    expect(screen.getByText("Hi there! How can I help?")).toBeInTheDocument()
  })

  it("only displays assistant messages, not user messages", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "User message", createdAt: Date.now() },
      { id: "2", role: "assistant", content: "Assistant message", createdAt: Date.now() },
    ]

    mockUseClaude.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.queryByText("User message")).not.toBeInTheDocument()
    expect(screen.getByText("Assistant message")).toBeInTheDocument()
  })

  it("shows Clear button when there are messages", () => {
    const messages: Message[] = [
      { id: "1", role: "assistant", content: "Response", createdAt: Date.now() },
    ]

    mockUseClaude.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
  })

  it("does not show Clear button when there are no messages", () => {
    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument()
  })

  it("calls reset when Clear button is clicked", async () => {
    const user = userEvent.setup()
    const messages: Message[] = [
      { id: "1", role: "assistant", content: "Response", createdAt: Date.now() },
    ]

    mockUseClaude.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    await user.click(screen.getByRole("button", { name: /clear/i }))

    expect(mockReset).toHaveBeenCalled()
  })

  it("displays API error from useClaude", () => {
    mockUseClaude.mockReturnValue({
      messages: [],
      isLoading: false,
      error: "API rate limited",
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    expect(screen.getByRole("alert")).toHaveTextContent("API rate limited")
  })

  it("calls onMessagesChange callback when messages are updated", async () => {
    const user = userEvent.setup()
    const onMessagesChange = vi.fn()
    mockSend.mockResolvedValue({ content: "Response content", success: true })

    render(
      <ClaudeSection
        entryContent="My entry"
        apiKey="test-key"
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

  it("calls onMessagesChange with empty array when reset", async () => {
    const user = userEvent.setup()
    const onMessagesChange = vi.fn()
    const messages: Message[] = [
      { id: "1", role: "assistant", content: "Response", createdAt: Date.now() },
    ]

    mockUseClaude.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(
      <ClaudeSection
        entryContent="Test entry"
        apiKey="test-key"
        onMessagesChange={onMessagesChange}
      />,
    )

    await user.click(screen.getByRole("button", { name: /clear/i }))

    expect(onMessagesChange).toHaveBeenCalledWith([])
  })

  it("initializes with provided initial messages", () => {
    const initialMessages: Message[] = [
      { id: "1", role: "user", content: "Previous", createdAt: 1000 },
      { id: "2", role: "assistant", content: "Previous response", createdAt: 1001 },
    ]

    render(
      <ClaudeSection
        entryContent="Test entry"
        apiKey="test-key"
        initialMessages={initialMessages}
      />,
    )

    expect(mockUseClaude).toHaveBeenCalledWith({
      apiKey: "test-key",
      initialMessages,
    })
  })

  it("displays multiple assistant responses", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "First question", createdAt: 1000 },
      { id: "2", role: "assistant", content: "First response", createdAt: 1001 },
      { id: "3", role: "user", content: "Second question", createdAt: 2000 },
      { id: "4", role: "assistant", content: "Second response", createdAt: 2001 },
    ]

    mockUseClaude.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: mockReset,
      setMessages: mockSetMessages,
    })

    render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

    const responses = screen.getAllByTestId("claude-response")
    expect(responses).toHaveLength(2)
    expect(screen.getByText("First response")).toBeInTheDocument()
    expect(screen.getByText("Second response")).toBeInTheDocument()
  })

  describe("follow-up messages", () => {
    it("shows follow-up input after initial conversation", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

      expect(screen.getByRole("textbox", { name: /follow-up message/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeInTheDocument()
    })

    it("does not show follow-up input when there are no messages", () => {
      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

      expect(screen.queryByRole("textbox", { name: /follow-up message/i })).not.toBeInTheDocument()
    })

    it("does not show follow-up input without API key", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<ClaudeSection entryContent="Test entry" apiKey="" />)

      expect(screen.queryByRole("textbox", { name: /follow-up message/i })).not.toBeInTheDocument()
    })

    it("disables follow-up input while loading", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: true,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

      expect(screen.getByRole("textbox", { name: /follow-up message/i })).toBeDisabled()
      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeDisabled()
    })

    it("sends follow-up message when send button is clicked", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

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

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

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

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

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

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

      expect(screen.getByRole("button", { name: /send follow-up/i })).toBeDisabled()
    })

    it("does not send follow-up when input is only whitespace", async () => {
      const user = userEvent.setup()
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", createdAt: Date.now() },
      ]

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      render(<ClaudeSection entryContent="Test entry" apiKey="test-key" />)

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

      mockUseClaude.mockReturnValue({
        messages,
        isLoading: false,
        error: null,
        send: mockSend,
        reset: mockReset,
        setMessages: mockSetMessages,
      })

      mockSend.mockResolvedValue({ content: "Follow-up response", success: true })

      render(
        <ClaudeSection
          entryContent="Test entry"
          apiKey="test-key"
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
  })
})
