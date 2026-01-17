import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useLLM } from "./useLLM"
import * as claudeProviderModule from "@/lib/llm/providers/claude"
import type { Message } from "@/types/journal"
import type { LLMResponse, LLMProvider } from "@/lib/llm/types"

// Mock the Claude provider module
vi.mock("@/lib/llm/providers/claude", () => ({
  createClaudeProvider: vi.fn(),
}))

const mockCreateClaudeProvider = vi.mocked(claudeProviderModule.createClaudeProvider)

describe("useLLM", () => {
  const defaultOptions = {
    provider: "claude" as const,
    apiKey: "test-api-key",
  }

  let mockSendMessage: Mock<LLMProvider["sendMessage"]>

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a mock sendMessage function that will be used by the mock provider
    mockSendMessage = vi.fn<LLMProvider["sendMessage"]>()

    // Setup the mock provider factory
    mockCreateClaudeProvider.mockReturnValue({
      type: "claude",
      sendMessage: mockSendMessage,
    })
  })

  it("initializes with empty messages by default", () => {
    const { result } = renderHook(() => useLLM(defaultOptions))

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("initializes with provided initial messages", () => {
    const initialMessages: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: 1000 },
      { id: "2", role: "assistant", content: "Hi there!", createdAt: 1001 },
    ]

    const { result } = renderHook(() => useLLM({ ...defaultOptions, initialMessages }))

    expect(result.current.messages).toEqual(initialMessages)
  })

  it("creates provider with correct config", () => {
    const options = {
      provider: "claude" as const,
      apiKey: "custom-key",
      model: "claude-3-opus",
      maxTokens: 2048,
    }

    renderHook(() => useLLM(options))

    expect(mockCreateClaudeProvider).toHaveBeenCalledWith({
      apiKey: "custom-key",
      model: "claude-3-opus",
      maxTokens: 2048,
    })
  })

  it("sends a message and receives a response", async () => {
    mockSendMessage.mockResolvedValue({
      content: "I can help you reflect!",
      success: true,
    })

    const { result } = renderHook(() => useLLM(defaultOptions))

    await act(async () => {
      await result.current.send("Help me journal")
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe("user")
    expect(result.current.messages[0].content).toBe("Help me journal")
    expect(result.current.messages[1].role).toBe("assistant")
    expect(result.current.messages[1].content).toBe("I can help you reflect!")
    expect(result.current.error).toBeNull()
  })

  it("sets isLoading to true while sending", async () => {
    let resolvePromise: (value: LLMResponse) => void
    mockSendMessage.mockImplementation(
      () =>
        new Promise(resolve => {
          resolvePromise = resolve
        }),
    )

    const { result } = renderHook(() => useLLM(defaultOptions))

    act(() => {
      result.current.send("Hello")
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolvePromise!({ content: "Hi!", success: true })
    })

    expect(result.current.isLoading).toBe(false)
  })

  it("shows user message immediately (optimistically) before assistant response arrives", async () => {
    let resolvePromise: (value: LLMResponse) => void
    mockSendMessage.mockImplementation(
      () =>
        new Promise(resolve => {
          resolvePromise = resolve
        }),
    )

    const { result } = renderHook(() => useLLM(defaultOptions))

    // Start sending a message but don't wait for it to complete
    act(() => {
      result.current.send("My message")
    })

    // While still loading, the user message should already be visible
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe("user")
    expect(result.current.messages[0].content).toBe("My message")

    // Now resolve the promise
    await act(async () => {
      resolvePromise!({ content: "Response!", success: true })
    })

    // After completion, both messages should be present
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe("user")
    expect(result.current.messages[1].role).toBe("assistant")
  })

  it("handles API errors and removes optimistic message", async () => {
    mockSendMessage.mockResolvedValue({
      content: "",
      success: false,
      error: "API rate limited",
    })

    const { result } = renderHook(() => useLLM(defaultOptions))

    await act(async () => {
      await result.current.send("Hello")
    })

    expect(result.current.messages).toHaveLength(0)
    expect(result.current.error).toBe("API rate limited")
  })

  it("returns error for empty message content", async () => {
    const { result } = renderHook(() => useLLM(defaultOptions))

    let response: LLMResponse
    await act(async () => {
      response = await result.current.send("   ")
    })

    expect(response!.success).toBe(false)
    expect(response!.error).toBe("Message content cannot be empty")
    expect(result.current.messages).toHaveLength(0)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it("trims message content before sending", async () => {
    mockSendMessage.mockResolvedValue({
      content: "Response",
      success: true,
    })

    const { result } = renderHook(() => useLLM(defaultOptions))

    await act(async () => {
      await result.current.send("  Hello world  ")
    })

    expect(result.current.messages[0].content).toBe("Hello world")
    expect(mockSendMessage).toHaveBeenCalledWith([], "Hello world")
  })

  it("passes existing messages to provider sendMessage", async () => {
    mockSendMessage.mockResolvedValue({
      content: "Response",
      success: true,
    })

    const initialMessages: Message[] = [
      { id: "1", role: "user", content: "First", createdAt: 1000 },
      { id: "2", role: "assistant", content: "Response 1", createdAt: 1001 },
    ]

    const { result } = renderHook(() => useLLM({ ...defaultOptions, initialMessages }))

    await act(async () => {
      await result.current.send("Second")
    })

    expect(mockSendMessage).toHaveBeenCalledWith(initialMessages, "Second")
  })

  it("resets conversation state", async () => {
    mockSendMessage.mockResolvedValue({
      content: "Response",
      success: true,
    })

    const { result } = renderHook(() => useLLM(defaultOptions))

    await act(async () => {
      await result.current.send("Hello")
    })

    expect(result.current.messages).toHaveLength(2)

    act(() => {
      result.current.reset()
    })

    expect(result.current.messages).toHaveLength(0)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it("allows setting messages directly", () => {
    const { result } = renderHook(() => useLLM(defaultOptions))

    const newMessages: Message[] = [
      { id: "a", role: "user", content: "Loaded message", createdAt: 2000 },
    ]

    act(() => {
      result.current.setMessages(newMessages)
    })

    expect(result.current.messages).toEqual(newMessages)
  })

  it("clears error on successful send after failure", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        content: "",
        success: false,
        error: "First error",
      })
      .mockResolvedValueOnce({
        content: "Success!",
        success: true,
      })

    const { result } = renderHook(() => useLLM(defaultOptions))

    await act(async () => {
      await result.current.send("First")
    })

    expect(result.current.error).toBe("First error")

    await act(async () => {
      await result.current.send("Second")
    })

    expect(result.current.error).toBeNull()
    expect(result.current.messages).toHaveLength(2)
  })

  it("generates unique IDs for messages", async () => {
    mockSendMessage
      .mockResolvedValueOnce({ content: "Response 1", success: true })
      .mockResolvedValueOnce({ content: "Response 2", success: true })

    const { result } = renderHook(() => useLLM(defaultOptions))

    await act(async () => {
      await result.current.send("First")
      await result.current.send("Second")
    })

    const ids = result.current.messages.map(m => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it("handles rapid consecutive sends without race conditions", async () => {
    // Track the messages passed to each API call
    const callHistory: Message[][] = []

    mockSendMessage.mockImplementation(async (messages: Message[]) => {
      // Capture a copy of messages at the time of the call
      callHistory.push([...messages])
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10))
      return { content: "Response", success: true }
    })

    const { result } = renderHook(() => useLLM(defaultOptions))

    // Send two messages rapidly without waiting for the first to complete
    await act(async () => {
      const promise1 = result.current.send("First message")
      const promise2 = result.current.send("Second message")
      await Promise.all([promise1, promise2])
    })

    // Both calls should have been made
    expect(callHistory).toHaveLength(2)

    // The second call should include the first user message in its history
    // This validates that the ref-based approach fixes the race condition
    // where the second call would otherwise see an empty messages array
    expect(callHistory[1].length).toBeGreaterThanOrEqual(1)
    expect(callHistory[1].some(m => m.content === "First message")).toBe(true)
  })

  it("throws error for unsupported provider", () => {
    expect(() =>
      renderHook(() =>
        useLLM({
          // @ts-expect-error - Testing invalid provider
          provider: "unsupported",
          apiKey: "test-key",
        }),
      ),
    ).toThrow("Unknown provider: unsupported")
  })

  it("syncs messages when initialMessages prop changes (navigation between days)", async () => {
    const day1Messages: Message[] = [
      { id: "1", role: "user", content: "Day 1 question", createdAt: 1000 },
      { id: "2", role: "assistant", content: "Day 1 response", createdAt: 1001 },
    ]
    const day2Messages: Message[] = [
      { id: "3", role: "user", content: "Day 2 question", createdAt: 2000 },
      { id: "4", role: "assistant", content: "Day 2 response", createdAt: 2001 },
    ]

    // Start with Day 1 messages
    const { result, rerender } = renderHook(
      ({ initialMessages }) => useLLM({ ...defaultOptions, initialMessages }),
      { initialProps: { initialMessages: day1Messages } },
    )

    expect(result.current.messages).toEqual(day1Messages)

    // Simulate navigation to Day 2 by changing initialMessages prop
    rerender({ initialMessages: day2Messages })

    expect(result.current.messages).toEqual(day2Messages)

    // Navigate to a day with no messages
    rerender({ initialMessages: [] })

    expect(result.current.messages).toEqual([])

    // Navigate back to Day 1
    rerender({ initialMessages: day1Messages })

    expect(result.current.messages).toEqual(day1Messages)
  })

  it("clears error when initialMessages changes", async () => {
    mockSendMessage.mockResolvedValue({
      content: "",
      success: false,
      error: "API error",
    })

    const { result, rerender } = renderHook(
      ({ initialMessages }) => useLLM({ ...defaultOptions, initialMessages }),
      { initialProps: { initialMessages: [] as Message[] } },
    )

    // Trigger an error
    await act(async () => {
      await result.current.send("Hello")
    })

    expect(result.current.error).toBe("API error")

    // Navigate to another day (change initialMessages)
    const newMessages: Message[] = [
      { id: "1", role: "user", content: "Previous question", createdAt: 1000 },
    ]
    rerender({ initialMessages: newMessages })

    // Error should be cleared when navigating to a new day
    expect(result.current.error).toBeNull()
    expect(result.current.messages).toEqual(newMessages)
  })
})
