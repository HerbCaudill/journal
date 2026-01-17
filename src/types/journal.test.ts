import { describe, it, expect } from "vitest"
import type { JournalDoc, JournalEntry, Message, Settings, DateString } from "./journal"
import { isDateString, toDateString, toDateStringOrUndefined } from "./journal"

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
    const date = toDateString("2026-01-16")
    const entry: JournalEntry = {
      id: "entry-1",
      date,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    expect(entry.id).toBe("entry-1")
    expect(entry.date).toBe("2026-01-16")
    expect(entry.messages).toEqual([])
  })

  it("should allow creating a JournalEntry with position", () => {
    const date = toDateString("2026-01-16")
    const entry: JournalEntry = {
      id: "entry-1",
      date,
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

  describe("DateString branded type", () => {
    describe("isDateString", () => {
      it("should return true for valid ISO date strings", () => {
        expect(isDateString("2026-01-16")).toBe(true)
        expect(isDateString("2025-12-31")).toBe(true)
        expect(isDateString("2026-02-28")).toBe(true)
      })

      it("should return true for leap year dates", () => {
        expect(isDateString("2024-02-29")).toBe(true) // 2024 is a leap year
      })

      it("should return false for invalid format", () => {
        expect(isDateString("01-16-2026")).toBe(false)
        expect(isDateString("2026/01/16")).toBe(false)
        expect(isDateString("2026-1-16")).toBe(false)
        expect(isDateString("not-a-date")).toBe(false)
        expect(isDateString("")).toBe(false)
      })

      it("should return false for invalid date values", () => {
        expect(isDateString("2026-13-01")).toBe(false) // Invalid month
        expect(isDateString("2026-00-01")).toBe(false) // Invalid month
        expect(isDateString("2026-02-30")).toBe(false) // February 30 doesn't exist
        expect(isDateString("2025-02-29")).toBe(false) // 2025 is not a leap year
        expect(isDateString("2026-04-31")).toBe(false) // April has 30 days
      })
    })

    describe("toDateString", () => {
      it("should return DateString for valid date strings", () => {
        const result = toDateString("2026-01-16")
        expect(result).toBe("2026-01-16")
        // Type assertion that it compiles as DateString
        const _typed: DateString = result
        expect(_typed).toBe("2026-01-16")
      })

      it("should throw for invalid date strings", () => {
        expect(() => toDateString("invalid")).toThrow("Invalid date format")
        expect(() => toDateString("2026-13-01")).toThrow("Invalid date format")
        expect(() => toDateString("01-16-2026")).toThrow("Invalid date format")
      })
    })

    describe("toDateStringOrUndefined", () => {
      it("should return DateString for valid date strings", () => {
        const result = toDateStringOrUndefined("2026-01-16")
        expect(result).toBe("2026-01-16")
      })

      it("should return undefined for invalid date strings", () => {
        expect(toDateStringOrUndefined("invalid")).toBeUndefined()
        expect(toDateStringOrUndefined("2026-13-01")).toBeUndefined()
        expect(toDateStringOrUndefined("01-16-2026")).toBeUndefined()
      })
    })

    it("should use DateString as JournalDoc entries key", () => {
      const date = toDateString("2026-01-16")
      const entry: JournalEntry = {
        id: "entry-1",
        date: date,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc: JournalDoc = {
        entries: {
          [date]: entry,
        },
        settings: {
          displayName: "Test User",
          timezone: "UTC",
          theme: "light",
          llmProvider: "claude",
        },
      }

      expect(doc.entries[date]).toBe(entry)
    })
  })
})
