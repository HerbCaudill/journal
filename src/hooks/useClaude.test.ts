import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useClaude } from "./useClaude"
import * as claudeModule from "@/lib/claude"
import type { Message } from "@/types/journal"

// Mock the claude module
vi.mock("@/lib/claude", () => ({
  sendMessage: vi.fn(),
}))

const mockSendMessage = vi.mocked(claudeModule.sendMessage)

describe("useClaude", () => {
  const defaultOptions = {
    apiKey: "test-api-key",
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("initializes with empty messages by default", () => {
    const { result } = renderHook(() => useClaude(defaultOptions))

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("initializes with provided initial messages", () => {
    const initialMessages: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: 1000 },
      { id: "2", role: "assistant", content: "Hi there!", createdAt: 1001 },
    ]

    const { result } = renderHook(() => useClaude({ ...defaultOptions, initialMessages }))

    expect(result.current.messages).toEqual(initialMessages)
  })

  it("sends a message and receives a response", async () => {
    mockSendMessage.mockResolvedValue({
      content: "I can help you reflect!",
      success: true,
    })

    const { result } = renderHook(() => useClaude(defaultOptions))

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
    let resolvePromise: (value: claudeModule.ClaudeResponse) => void
    mockSendMessage.mockImplementation(
      () =>
        new Promise(resolve => {
          resolvePromise = resolve
        }),
    )

    const { result } = renderHook(() => useClaude(defaultOptions))

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

  it("handles API errors and removes optimistic message", async () => {
    mockSendMessage.mockResolvedValue({
      content: "",
      success: false,
      error: "API rate limited",
    })

    const { result } = renderHook(() => useClaude(defaultOptions))

    await act(async () => {
      await result.current.send("Hello")
    })

    expect(result.current.messages).toHaveLength(0)
    expect(result.current.error).toBe("API rate limited")
  })

  it("returns error for empty message content", async () => {
    const { result } = renderHook(() => useClaude(defaultOptions))

    let response: claudeModule.ClaudeResponse
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

    const { result } = renderHook(() => useClaude(defaultOptions))

    await act(async () => {
      await result.current.send("  Hello world  ")
    })

    expect(result.current.messages[0].content).toBe("Hello world")
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "Hello world",
    )
  })

  it("passes config options to sendMessage", async () => {
    mockSendMessage.mockResolvedValue({
      content: "Response",
      success: true,
    })

    const options = {
      apiKey: "custom-key",
      model: "claude-3-opus",
      maxTokens: 2048,
    }

    const { result } = renderHook(() => useClaude(options))

    await act(async () => {
      await result.current.send("Hello")
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      {
        apiKey: "custom-key",
        model: "claude-3-opus",
        maxTokens: 2048,
      },
      [],
      "Hello",
    )
  })

  it("passes existing messages to sendMessage", async () => {
    mockSendMessage.mockResolvedValue({
      content: "Response",
      success: true,
    })

    const initialMessages: Message[] = [
      { id: "1", role: "user", content: "First", createdAt: 1000 },
      { id: "2", role: "assistant", content: "Response 1", createdAt: 1001 },
    ]

    const { result } = renderHook(() => useClaude({ ...defaultOptions, initialMessages }))

    await act(async () => {
      await result.current.send("Second")
    })

    expect(mockSendMessage).toHaveBeenCalledWith(expect.anything(), initialMessages, "Second")
  })

  it("resets conversation state", async () => {
    mockSendMessage.mockResolvedValue({
      content: "Response",
      success: true,
    })

    const { result } = renderHook(() => useClaude(defaultOptions))

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
    const { result } = renderHook(() => useClaude(defaultOptions))

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

    const { result } = renderHook(() => useClaude(defaultOptions))

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

    const { result } = renderHook(() => useClaude(defaultOptions))

    await act(async () => {
      await result.current.send("First")
      await result.current.send("Second")
    })

    const ids = result.current.messages.map(m => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
