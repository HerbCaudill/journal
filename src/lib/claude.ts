import Anthropic from "@anthropic-ai/sdk"
import type { Message } from "@/types/journal"

/**
 * Configuration options for the Claude client
 */
export interface ClaudeConfig {
  /** Anthropic API key */
  apiKey: string
  /** Model to use (defaults to claude-sonnet-4-20250514) */
  model?: string
  /** Maximum tokens in the response */
  maxTokens?: number
}

/**
 * Response from sending a message to Claude
 */
export interface ClaudeResponse {
  /** The assistant's response content */
  content: string
  /** Whether the request was successful */
  success: boolean
  /** Error message if the request failed */
  error?: string
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514"
const DEFAULT_MAX_TOKENS = 4096

const SYSTEM_PROMPT = `You are a thoughtful journaling assistant. Your role is to help the user reflect on their day, thoughts, and feelings. Be empathetic, ask clarifying questions when appropriate, and help them explore their thoughts more deeply. Keep your responses concise but meaningful.`

/**
 * Create an Anthropic client instance
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
function toAnthropicMessages(
  messages: Message[]
): Anthropic.MessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))
}

/**
 * Send a message to Claude and get a response
 *
 * @param config - Configuration including API key and optional model settings
 * @param messages - Array of previous messages in the conversation
 * @param userMessage - The new user message to send
 * @returns The assistant's response
 */
export async function sendMessage(
  config: ClaudeConfig,
  messages: Message[],
  userMessage: string
): Promise<ClaudeResponse> {
  if (!config.apiKey) {
    return {
      content: "",
      success: false,
      error: "API key is required",
    }
  }

  try {
    const client = createClient(config.apiKey)

    // Combine existing messages with the new user message
    const allMessages: Anthropic.MessageParam[] = [
      ...toAnthropicMessages(messages),
      { role: "user", content: userMessage },
    ]

    const response = await client.messages.create({
      model: config.model ?? DEFAULT_MODEL,
      max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: allMessages,
    })

    // Extract text content from the response
    const textContent = response.content.find((block) => block.type === "text")
    const content = textContent?.type === "text" ? textContent.text : ""

    return {
      content,
      success: true,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred"
    return {
      content: "",
      success: false,
      error: errorMessage,
    }
  }
}
