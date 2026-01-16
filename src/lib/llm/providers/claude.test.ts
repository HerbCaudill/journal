import { describe, it, expect, vi, beforeEach } from "vitest"
import { createClaudeProvider, ClaudeProvider } from "./claude"
import type { LLMConfig } from "../types"
import type { Message } from "@/types/journal"

// Mock the entire module
const mockCreate = vi.fn()

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      }
    },
  }
})

describe("ClaudeProvider", () => {
  const mockConfig: LLMConfig = {
    apiKey: "test-api-key",
  }

  const mockMessages: Message[] = [
    {
      id: "1",
      role: "user",
      content: "Hello",
      createdAt: Date.now(),
    },
    {
      id: "2",
      role: "assistant",
      content: "Hi there!",
      createdAt: Date.now(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createClaudeProvider", () => {
    it("creates a ClaudeProvider instance", () => {
      const provider = createClaudeProvider(mockConfig)
      expect(provider).toBeInstanceOf(ClaudeProvider)
      expect(provider.type).toBe("claude")
    })
  })

  describe("sendMessage", () => {
    it("returns error when API key is missing", async () => {
      const provider = createClaudeProvider({ apiKey: "" })
      const result = await provider.sendMessage([], "Hello")

      expect(result.success).toBe(false)
      expect(result.error).toBe("API key is required")
      expect(result.content).toBe("")
    })

    it("sends messages to Claude and returns response", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "This is a response" }],
      }

      mockCreate.mockResolvedValue(mockResponse)

      const provider = createClaudeProvider(mockConfig)
      const result = await provider.sendMessage(mockMessages, "How are you?")

      expect(result.success).toBe(true)
      expect(result.content).toBe("This is a response")
      expect(result.error).toBeUndefined()

      // Verify the API was called with correct parameters
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: expect.arrayContaining([
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
            { role: "user", content: "How are you?" },
          ]),
        }),
      )
    })

    it("uses custom model and max tokens when provided", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "Response" }],
      }

      mockCreate.mockResolvedValue(mockResponse)

      const customConfig: LLMConfig = {
        apiKey: "test-key",
        model: "claude-3-opus-20240229",
        maxTokens: 2048,
      }

      const provider = createClaudeProvider(customConfig)
      await provider.sendMessage([], "Hello")

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-opus-20240229",
          max_tokens: 2048,
        }),
      )
    })

    it("handles API errors gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limited"))

      const provider = createClaudeProvider(mockConfig)
      const result = await provider.sendMessage([], "Hello")

      expect(result.success).toBe(false)
      expect(result.error).toBe("API rate limited")
      expect(result.content).toBe("")
    })

    it("handles non-Error exceptions", async () => {
      mockCreate.mockRejectedValue("string error")

      const provider = createClaudeProvider(mockConfig)
      const result = await provider.sendMessage([], "Hello")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Unknown error occurred")
      expect(result.content).toBe("")
    })

    it("handles empty response content", async () => {
      const mockResponse = {
        content: [],
      }

      mockCreate.mockResolvedValue(mockResponse)

      const provider = createClaudeProvider(mockConfig)
      const result = await provider.sendMessage([], "Hello")

      expect(result.success).toBe(true)
      expect(result.content).toBe("")
    })
  })

  describe("provider type", () => {
    it("has type 'claude'", () => {
      const provider = createClaudeProvider(mockConfig)
      expect(provider.type).toBe("claude")
    })
  })
})
