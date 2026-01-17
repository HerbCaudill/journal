import { describe, it, expect } from "vitest"
import type { JournalDoc, JournalEntry, Message, Settings } from "./journal"

describe("Journal types", () => {
  it("should allow creating a valid Message", () => {
    const message: Message = {
      id: "msg-1",
      role: "user",
      content: "Hello, world!",
      createdAt: Date.now(),
    }

    expect(message.id).toBe("msg-1")
    expect(message.role).toBe("user")
    expect(message.content).toBe("Hello, world!")
    expect(typeof message.createdAt).toBe("number")
  })

  it("should allow creating a valid JournalEntry", () => {
    const entry: JournalEntry = {
      id: "entry-1",
      date: "2026-01-16",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    expect(entry.id).toBe("entry-1")
    expect(entry.date).toBe("2026-01-16")
    expect(entry.messages).toEqual([])
  })

  it("should allow creating a JournalEntry with position", () => {
    const entry: JournalEntry = {
      id: "entry-1",
      date: "2026-01-16",
      messages: [],
      position: {
        latitude: 41.9286,
        longitude: 3.2014,
        accuracy: 10,
        timestamp: Date.now(),
        locality: "Tamariu",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    expect(entry.position).toBeDefined()
    expect(entry.position?.latitude).toBe(41.9286)
    expect(entry.position?.longitude).toBe(3.2014)
    expect(entry.position?.locality).toBe("Tamariu")
  })

  it("should allow creating valid Settings", () => {
    const settings: Settings = {
      displayName: "Test User",
      timezone: "America/New_York",
      theme: "system",
      llmProvider: "claude",
    }

    expect(settings.displayName).toBe("Test User")
    expect(settings.theme).toBe("system")
    expect(settings.llmProvider).toBe("claude")
  })

  it("should allow creating a valid JournalDoc", () => {
    const doc: JournalDoc = {
      entries: {},
      settings: {
        displayName: "Test User",
        timezone: "UTC",
        theme: "light",
        llmProvider: "claude",
      },
    }

    expect(doc.entries).toEqual({})
    expect(doc.settings.displayName).toBe("Test User")
  })
})
