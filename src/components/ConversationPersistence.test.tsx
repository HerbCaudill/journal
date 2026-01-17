/**
 * Integration tests for conversation persistence
 *
 * These tests verify that conversations are correctly persisted to the Automerge document
 * and can be restored on component re-mount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JournalDoc, Message } from "../types/journal"
import { toDateString } from "../types/journal"
import type { Doc, ChangeFn } from "@automerge/automerge"

// Create a mock document that tracks changes
let mockDoc: Doc<JournalDoc>

const createInitialDoc = (): Doc<JournalDoc> =>
  ({
    entries: {},
    settings: {
      displayName: "",
      timezone: "UTC",
      theme: "system",
      llmProvider: "claude",
      claudeApiKey: "sk-ant-test-key",
    },
  }) as Doc<JournalDoc>

// Mock changeDoc that actually mutates the mock document
const mockChangeDoc = vi.fn((changeFn: ChangeFn<JournalDoc>) => {
  // Create a deep clone and apply changes
  const draft = JSON.parse(JSON.stringify(mockDoc))
  changeFn(draft)
  mockDoc = draft as Doc<JournalDoc>
})

// Mock useJournal
vi.mock("../context/JournalContext", () => ({
  useJournal: vi.fn(() => ({
    doc: mockDoc,
    changeDoc: mockChangeDoc,
    handle: undefined,
    isLoading: false,
  })),
}))

// Mock useLLM with controllable state
let mockMessages: Message[] = []
const mockSend = vi.fn()
const mockSetMessages = vi.fn()

vi.mock("../hooks/useLLM", () => ({
  useLLM: vi.fn(({ initialMessages = [] }) => {
    // Sync internal state when initialMessages changes
    if (initialMessages.length > 0 && mockMessages.length === 0) {
      mockMessages = initialMessages
    }
    return {
      messages: mockMessages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: vi.fn(),
      setMessages: mockSetMessages,
    }
  }),
}))

// Mock useGoogleCalendar
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

// Import components after mocking
import { LLMSection } from "./LLMSection"
import * as JournalContext from "../context/JournalContext"
import * as useLLMHook from "../hooks/useLLM"

describe("Conversation Persistence", () => {
  const TEST_DATE = toDateString("2024-06-15")

  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc = createInitialDoc()
    mockMessages = []

    // Set up the journal entry first (simulating what EntryEditor would do)
    mockDoc.entries[TEST_DATE] = {
      id: `entry-${TEST_DATE}`,
      date: TEST_DATE,
      messages: [
        {
          id: "entry-user-1",
          role: "user",
          content: "Today was a good day. I learned about testing.",
          createdAt: 1000,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    }

    // Reset mocks to return fresh doc
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: mockDoc,
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("persists initial Claude response to document", async () => {
    // Setup: mock send to return a successful response with messages array
    mockSend.mockImplementation(async (content: string) => {
      // Simulate useLLM adding messages to its internal state
      mockMessages = [
        {
          id: "llm-user-1",
          role: "user" as const,
          content: content,
          createdAt: Date.now(),
        },
        {
          id: "llm-assistant-1",
          role: "assistant" as const,
          content: "That sounds wonderful! What did you learn specifically?",
          createdAt: Date.now(),
        },
      ]
      // Return response with messages array (as useLLM now does)
      return {
        content: "That sounds wonderful! What did you learn specifically?",
        success: true,
        messages: mockMessages,
      }
    })

    // Note: We test LLMSection directly since DayView involves more complex mocking
    const onMessagesChange = vi.fn()

    render(
      <LLMSection
        entryContent="Today was a good day. I learned about testing."
        apiKey="sk-ant-test-key"
        provider="claude"
        onMessagesChange={onMessagesChange}
        conversationKey={TEST_DATE}
      />,
    )

    // Find and click the Ask Claude button
    const askButton = screen.getByRole("button", { name: /ask claude/i })
    await userEvent.click(askButton)

    // Verify onMessagesChange was called with the conversation
    await waitFor(() => {
      expect(onMessagesChange).toHaveBeenCalled()
    })

    const messages = onMessagesChange.mock.calls[0][0] as Message[]

    // Should include user message and assistant response
    expect(messages.length).toBe(2)
    expect(messages[0].role).toBe("user")
    expect(messages[0].content).toBe("Today was a good day. I learned about testing.")
    expect(messages[1].role).toBe("assistant")
    expect(messages[1].content).toBe("That sounds wonderful! What did you learn specifically?")
  })

  it("persists follow-up messages to document", async () => {
    // Setup: Start with an existing conversation
    const existingMessages: Message[] = [
      {
        id: "user-1",
        role: "user" as const,
        content: "Initial entry",
        createdAt: 1000,
      },
      {
        id: "assistant-1",
        role: "assistant" as const,
        content: "First response",
        createdAt: 1001,
      },
    ]

    mockMessages = existingMessages

    // Mock useLLM to return the existing messages
    vi.mocked(useLLMHook.useLLM).mockReturnValue({
      messages: existingMessages,
      isLoading: false,
      error: null,
      send: mockSend,
      reset: vi.fn(),
      setMessages: mockSetMessages,
    })

    mockSend.mockImplementation(async (content: string) => {
      // Simulate useLLM adding messages
      mockMessages = [
        ...existingMessages,
        {
          id: "user-2",
          role: "user" as const,
          content: content,
          createdAt: Date.now(),
        },
        {
          id: "assistant-2",
          role: "assistant" as const,
          content: "Follow-up response",
          createdAt: Date.now(),
        },
      ]
      // Return response with messages array (as useLLM now does)
      return {
        content: "Follow-up response",
        success: true,
        messages: mockMessages,
      }
    })

    const onMessagesChange = vi.fn()

    render(
      <LLMSection
        entryContent="Initial entry"
        apiKey="sk-ant-test-key"
        provider="claude"
        initialMessages={existingMessages}
        onMessagesChange={onMessagesChange}
        conversationKey={TEST_DATE}
      />,
    )

    // Find the follow-up input
    const followUpInput = screen.getByRole("textbox", { name: /follow-up message/i })
    await userEvent.type(followUpInput, "This is my follow-up question")

    // Submit the follow-up
    const sendButton = screen.getByRole("button", { name: /send follow-up/i })
    await userEvent.click(sendButton)

    // Verify onMessagesChange was called with all messages
    await waitFor(() => {
      expect(onMessagesChange).toHaveBeenCalled()
    })

    const messages = onMessagesChange.mock.calls[0][0] as Message[]

    // Should include all 4 messages (initial + follow-up)
    expect(messages.length).toBe(4)
    expect(messages[0].role).toBe("user")
    expect(messages[1].role).toBe("assistant")
    expect(messages[2].role).toBe("user")
    expect(messages[2].content).toBe("This is my follow-up question")
    expect(messages[3].role).toBe("assistant")
    expect(messages[3].content).toBe("Follow-up response")
  })

  it("handleMessagesChange correctly merges with journal entry", () => {
    // This test verifies the DayView.handleMessagesChange logic

    // Initial document state: journal entry exists
    mockDoc.entries[TEST_DATE] = {
      id: `entry-${TEST_DATE}`,
      date: TEST_DATE,
      messages: [
        {
          id: "journal-entry-1",
          role: "user" as const,
          content: "My journal entry content",
          createdAt: 1000,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    }

    // Simulate what handleMessagesChange does when receiving conversation messages
    const conversationMessages: Message[] = [
      {
        id: "conv-user-1",
        role: "user" as const,
        content: "My journal entry content", // Note: this duplicates the journal entry
        createdAt: 2000,
      },
      {
        id: "conv-assistant-1",
        role: "assistant" as const,
        content: "Claude's response",
        createdAt: 2001,
      },
    ]

    // Apply the handleMessagesChange logic (copied from DayView)
    mockChangeDoc((d: JournalDoc) => {
      const existingEntry = d.entries[TEST_DATE]
      const firstUserMessage = existingEntry.messages.find(m => m.role === "user")

      // Clear and rebuild
      existingEntry.messages.splice(0, existingEntry.messages.length)

      if (firstUserMessage) {
        existingEntry.messages.push(firstUserMessage)
      }

      for (const msg of conversationMessages) {
        existingEntry.messages.push(msg)
      }
    })

    // Verify the final state
    const entry = mockDoc.entries[TEST_DATE]
    expect(entry.messages.length).toBe(3) // journal entry + duplicate user + assistant

    // The first message should be the original journal entry
    expect(entry.messages[0].id).toBe("journal-entry-1")
    expect(entry.messages[0].content).toBe("My journal entry content")

    // The second message is the duplicate (from LLMSection)
    expect(entry.messages[1].id).toBe("conv-user-1")

    // The third is the assistant response
    expect(entry.messages[2].id).toBe("conv-assistant-1")
    expect(entry.messages[2].content).toBe("Claude's response")
  })

  it("verifies exact document state after handleMessagesChange", () => {
    // Simulate exact flow: EntryEditor saves journal, then handleMessagesChange is called
    const TEST_DATE_2 = toDateString("2024-06-20")

    // Step 1: EntryEditor has saved the journal entry
    mockDoc.entries[TEST_DATE_2] = {
      id: `entry-${TEST_DATE_2}`,
      date: TEST_DATE_2,
      messages: [
        {
          id: "journal-entry-id",
          role: "user" as const,
          content: "Today I learned about React hooks.",
          createdAt: 1000,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    }

    // Step 2: Simulate what LLMSection.handleSubmit passes to onMessagesChange
    // (empty messages array spread + new user message + assistant response)
    const messagesFromCallback: Message[] = [
      // ...messages (empty on first submit)
      {
        id: "user-from-llmsection",
        role: "user" as const,
        content: "Today I learned about React hooks.", // Same as journal entry!
        createdAt: 2000,
      },
      {
        id: "assistant-from-llmsection",
        role: "assistant" as const,
        content: "That's wonderful! React hooks are powerful. What specifically did you learn?",
        createdAt: 2001,
      },
    ]

    // Step 3: Apply handleMessagesChange logic (copied from DayView)
    mockChangeDoc((d: JournalDoc) => {
      const existingEntry = d.entries[TEST_DATE_2]
      existingEntry.updatedAt = Date.now()

      // Keep the first user message (journal entry managed by EntryEditor)
      const firstUserMessage = existingEntry.messages.find(m => m.role === "user")

      // Clear existing messages and rebuild
      existingEntry.messages.splice(0, existingEntry.messages.length)

      if (firstUserMessage) {
        existingEntry.messages.push(firstUserMessage)
      }

      for (const msg of messagesFromCallback) {
        existingEntry.messages.push(msg)
      }
    })

    // Step 4: Verify document state
    const entry = mockDoc.entries[TEST_DATE_2]

    // Should have 3 messages: original journal entry + duplicate user + assistant
    expect(entry.messages.length).toBe(3)

    // First message: original journal entry from EntryEditor
    expect(entry.messages[0]).toEqual({
      id: "journal-entry-id",
      role: "user",
      content: "Today I learned about React hooks.",
      createdAt: 1000,
    })

    // Second message: duplicate from LLMSection
    expect(entry.messages[1]).toEqual({
      id: "user-from-llmsection",
      role: "user",
      content: "Today I learned about React hooks.",
      createdAt: 2000,
    })

    // Third message: assistant response
    expect(entry.messages[2]).toEqual({
      id: "assistant-from-llmsection",
      role: "assistant",
      content: "That's wonderful! React hooks are powerful. What specifically did you learn?",
      createdAt: 2001,
    })

    // Step 5: Verify conversation extraction (what LLMSection would receive on reload)
    const conversationMessages = entry.messages.slice(1)
    expect(conversationMessages.length).toBe(2)
    expect(conversationMessages[0].id).toBe("user-from-llmsection")
    expect(conversationMessages[1].id).toBe("assistant-from-llmsection")
  })

  it("conversation is correctly extracted from persisted messages", () => {
    // This test verifies that conversationMessages = allMessages.slice(1)
    // correctly extracts the conversation for LLMSection

    const persistedMessages: Message[] = [
      {
        id: "journal-entry",
        role: "user" as const,
        content: "Journal entry",
        createdAt: 1000,
      },
      {
        id: "duplicate-entry",
        role: "user" as const,
        content: "Journal entry",
        createdAt: 2000,
      },
      {
        id: "assistant-1",
        role: "assistant" as const,
        content: "Response 1",
        createdAt: 2001,
      },
      {
        id: "followup-user",
        role: "user" as const,
        content: "Follow-up",
        createdAt: 3000,
      },
      {
        id: "assistant-2",
        role: "assistant" as const,
        content: "Response 2",
        createdAt: 3001,
      },
    ]

    // Extract conversation messages (skip first user message)
    const conversationMessages = persistedMessages.slice(1)

    // Verify
    expect(conversationMessages.length).toBe(4)
    expect(conversationMessages[0].id).toBe("duplicate-entry")
    expect(conversationMessages[1].id).toBe("assistant-1")
    expect(conversationMessages[2].id).toBe("followup-user")
    expect(conversationMessages[3].id).toBe("assistant-2")
  })

  it("restores conversation correctly on reload simulation", () => {
    // This test simulates what happens when the page reloads:
    // 1. Automerge doc is loaded with persisted data
    // 2. DayView extracts conversationMessages
    // 3. LLMSection receives initialMessages
    // 4. useLLM syncs its state

    const RELOAD_DATE = toDateString("2024-07-01")

    // Simulate persisted document state (as it would be after a conversation)
    mockDoc.entries[RELOAD_DATE] = {
      id: `entry-${RELOAD_DATE}`,
      date: RELOAD_DATE,
      messages: [
        {
          id: "journal-entry",
          role: "user" as const,
          content: "My journal entry content",
          createdAt: 1000,
        },
        {
          id: "conversation-user",
          role: "user" as const,
          content: "My journal entry content", // Duplicate from LLMSection
          createdAt: 2000,
        },
        {
          id: "conversation-assistant",
          role: "assistant" as const,
          content: "Claude's response to your entry",
          createdAt: 2001,
        },
        {
          id: "followup-user",
          role: "user" as const,
          content: "My follow-up question",
          createdAt: 3000,
        },
        {
          id: "followup-assistant",
          role: "assistant" as const,
          content: "Claude's follow-up response",
          createdAt: 3001,
        },
      ],
      createdAt: 1000,
      updatedAt: 3001,
    }

    const entry = mockDoc.entries[RELOAD_DATE]

    // Step 1: DayView extracts data
    const allMessages = entry.messages
    const conversationMessages = allMessages.slice(1) // Skip journal entry
    const assistantMessages = conversationMessages.filter(m => m.role === "assistant")
    const hasConversation = assistantMessages.length > 0

    // Verify extraction
    expect(conversationMessages.length).toBe(4) // duplicate + assistant + followup + followup-assistant
    expect(assistantMessages.length).toBe(2)
    expect(hasConversation).toBe(true)

    // Step 2: Verify what LLMSection would receive
    expect(conversationMessages[0]).toEqual({
      id: "conversation-user",
      role: "user",
      content: "My journal entry content",
      createdAt: 2000,
    })
    expect(conversationMessages[1]).toEqual({
      id: "conversation-assistant",
      role: "assistant",
      content: "Claude's response to your entry",
      createdAt: 2001,
    })
    expect(conversationMessages[2]).toEqual({
      id: "followup-user",
      role: "user",
      content: "My follow-up question",
      createdAt: 3000,
    })
    expect(conversationMessages[3]).toEqual({
      id: "followup-assistant",
      role: "assistant",
      content: "Claude's follow-up response",
      createdAt: 3001,
    })

    // Step 3: Verify useLLM would sync correctly
    // (This is simulated - the actual hook would call setMessages)
    const initialMessagesKey = JSON.stringify(conversationMessages.map(m => m.id))
    expect(initialMessagesKey).toBe(
      '["conversation-user","conversation-assistant","followup-user","followup-assistant"]',
    )

    // The conversation should display correctly!
  })
})
