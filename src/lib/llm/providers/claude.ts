/**
 * Claude LLM Provider
 *
 * Implements the LLMProvider interface for Anthropic's Claude API.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { Message } from "@/types/journal"
import type { LLMConfig, LLMProvider, LLMResponse, LLMProviderFactory } from "../types"
import { DEFAULT_MODELS, DEFAULT_MAX_TOKENS } from "../types"

const BASE_SYSTEM_PROMPT = `You are a thoughtful journaling assistant. Your role is to help the user reflect on their day, thoughts, and feelings. Be empathetic, ask clarifying questions when appropriate, and help them explore their thoughts more deeply. Keep your responses concise but meaningful.`

/**
 * Build a system prompt by combining the base prompt with optional user bio and additional instructions
 */
function buildSystemPrompt(bio?: string, additionalInstructions?: string): string {
  let systemPrompt = BASE_SYSTEM_PROMPT

  if (bio?.trim()) {
    systemPrompt += `\n\nAbout the user:\n${bio.trim()}`
  }

  if (additionalInstructions?.trim()) {
    systemPrompt += `\n\nAdditional instructions:\n${additionalInstructions.trim()}`
  }

  return systemPrompt
}

/**
 * Create an Anthropic client instance
 *
 * DESIGN DECISION: dangerouslyAllowBrowser is enabled intentionally.
 *
 * This is a local-first PWA where users provide their own API keys. All data
 * (including the API key) is stored locally in the browser using IndexedDB.
 * There is no backend server - API calls are made directly from the browser.
 *
 * Security considerations:
 * - The API key is stored locally and never transmitted to any server except Anthropic
 * - Users are warned in the Settings UI about client-side API key storage
 * - Users are advised to use API keys with spending limits
 * - The app runs entirely on the user's device
 *
 * This trade-off enables the app to work offline-first without requiring users
 * to set up or pay for backend infrastructure.
 *
 * See also: SettingsView.tsx security warning displayed to users
 */
function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })
}

/**
 * Convert journal messages to Anthropic message format
 */
function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))
}

/**
 * Claude provider implementation
 */
class ClaudeProvider implements LLMProvider {
  readonly type = "claude" as const
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(messages: Message[], userMessage: string): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      return {
        content: "",
        success: false,
        error: "API key is required",
      }
    }

    try {
      const client = createClient(this.config.apiKey)

      // Combine existing messages with the new user message
      const allMessages: Anthropic.MessageParam[] = [
        ...toAnthropicMessages(messages),
        { role: "user", content: userMessage },
      ]

      const systemPrompt = buildSystemPrompt(this.config.bio, this.config.additionalInstructions)

      const response = await client.messages.create({
        model: this.config.model ?? DEFAULT_MODELS.claude,
        max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: allMessages,
      })

      // Extract text content from the response
      const textContent = response.content.find(block => block.type === "text")
      const content = textContent?.type === "text" ? textContent.text : ""

      return {
        content,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      return {
        content: "",
        success: false,
        error: errorMessage,
      }
    }
  }
}

/**
 * Factory function to create a Claude provider instance
 */
export const createClaudeProvider: LLMProviderFactory = (config: LLMConfig): LLMProvider => {
  return new ClaudeProvider(config)
}

export { ClaudeProvider }
