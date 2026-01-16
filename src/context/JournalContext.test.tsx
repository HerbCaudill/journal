import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { useJournal } from "./JournalContext"

describe("JournalContext", () => {
  it("throws error when used outside of JournalProvider", () => {
    // Suppress console.error for this test since we expect an error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => {
      renderHook(() => useJournal())
    }).toThrow("useJournal must be used within a JournalProvider")

    consoleSpy.mockRestore()
  })

  // Note: Full integration tests for JournalProvider require IndexedDB
  // which is not available in the jsdom test environment.
  // These are covered by Playwright e2e tests.
})
