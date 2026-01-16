import { describe, it, expect } from "vitest"
import type { ProviderType, LLMConfig, LLMResponse, LLMProvider, LLMProviderFactory } from "./types"
import { DEFAULT_MODELS, DEFAULT_MAX_TOKENS } from "./types"
import type { Message } from "@/types/journal"

describe("LLM Types", () => {
  describe("ProviderType", () => {
    it("should allow claude as a provider type", () => {
      const provider: ProviderType = "claude"
      expect(provider).toBe("claude")
    })

    it("should allow openai as a provider type", () => {
      const provider: ProviderType = "openai"
      expect(provider).toBe("openai")
    })
  })

  describe("LLMConfig", () => {
    it("should create a minimal config with just apiKey", () => {
      const config: LLMConfig = {
        apiKey: "test-api-key",
      }
      expect(config.apiKey).toBe("test-api-key")
      expect(config.model).toBeUndefined()
      expect(config.maxTokens).toBeUndefined()
    })

    it("should create a full config with all options", () => {
      const config: LLMConfig = {
        apiKey: "test-api-key",
        model: "custom-model",
        maxTokens: 2048,
      }
      expect(config.apiKey).toBe("test-api-key")
      expect(config.model).toBe("custom-model")
      expect(config.maxTokens).toBe(2048)
    })
  })

  describe("LLMResponse", () => {
    it("should create a successful response", () => {
      const response: LLMResponse = {
        content: "Hello, how can I help you?",
        success: true,
      }
      expect(response.content).toBe("Hello, how can I help you?")
      expect(response.success).toBe(true)
      expect(response.error).toBeUndefined()
    })

    it("should create an error response", () => {
      const response: LLMResponse = {
        content: "",
        success: false,
        error: "API key is required",
      }
      expect(response.content).toBe("")
      expect(response.success).toBe(false)
      expect(response.error).toBe("API key is required")
    })
  })

  describe("LLMProvider interface", () => {
    it("should be implementable as a class", async () => {
      // Mock provider implementation
      class MockProvider implements LLMProvider {
        readonly type: ProviderType = "claude"

        async sendMessage(_messages: Message[], userMessage: string): Promise<LLMResponse> {
          return {
            content: `Mock response to: ${userMessage}`,
            success: true,
          }
        }
      }

      const provider = new MockProvider()
      expect(provider.type).toBe("claude")

      const response = await provider.sendMessage([], "Hello")
      expect(response.success).toBe(true)
      expect(response.content).toBe("Mock response to: Hello")
    })

    it("should work with conversation history", async () => {
      class MockProvider implements LLMProvider {
        readonly type: ProviderType = "claude"

        async sendMessage(messages: Message[], userMessage: string): Promise<LLMResponse> {
          return {
            content: `Received ${messages.length} previous messages. New message: ${userMessage}`,
            success: true,
          }
        }
      }

      const messages: Message[] = [
        { id: "1", role: "user", content: "Hi", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hello!", createdAt: Date.now() },
      ]

      const provider = new MockProvider()
      const response = await provider.sendMessage(messages, "How are you?")

      expect(response.success).toBe(true)
      expect(response.content).toContain("Received 2 previous messages")
    })
  })

  describe("LLMProviderFactory", () => {
    it("should create providers from config", () => {
      class MockProvider implements LLMProvider {
        readonly type: ProviderType = "claude"
        config: LLMConfig

        constructor(config: LLMConfig) {
          this.config = config
        }

        async sendMessage(_messages: Message[], _userMessage: string): Promise<LLMResponse> {
          return { content: "test", success: true }
        }
      }

      const factory: LLMProviderFactory = config => new MockProvider(config)

      const config: LLMConfig = { apiKey: "test-key" }
      const provider = factory(config)

      expect(provider.type).toBe("claude")
    })
  })

  describe("DEFAULT_MODELS", () => {
    it("should have a default model for claude", () => {
      expect(DEFAULT_MODELS.claude).toBe("claude-sonnet-4-20250514")
    })

    it("should have a default model for openai", () => {
      expect(DEFAULT_MODELS.openai).toBe("gpt-4o")
    })
  })

  describe("DEFAULT_MAX_TOKENS", () => {
    it("should be 4096", () => {
      expect(DEFAULT_MAX_TOKENS).toBe(4096)
    })
  })
})
