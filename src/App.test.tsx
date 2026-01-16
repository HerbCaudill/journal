import { render, screen, act } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { App } from "./App"
import type { JournalDoc } from "./types/journal"
import type { Doc } from "@automerge/automerge"

// Mock the dates module to have consistent test results
vi.mock("./lib/dates", async () => {
  const actual = await vi.importActual("./lib/dates")
  return {
    ...actual,
    getToday: () => "2025-01-16",
  }
})

// Mock the JournalContext to avoid IndexedDB issues
vi.mock("./context/JournalContext", () => ({
  JournalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useJournal: () => ({
    doc: {
      entries: {},
      settings: {
        displayName: "",
        timezone: "UTC",
        theme: "system",
      },
    } as Doc<JournalDoc>,
    changeDoc: vi.fn(),
    handle: undefined,
    isLoading: false,
  }),
}))

describe("App", () => {
  beforeEach(() => {
    // Reset hash before each test
    window.location.hash = ""
  })

  it("renders header with today's date by default", () => {
    render(<App />)
    expect(screen.getByRole("banner")).toBeInTheDocument()
  })

  it("renders day view at root", () => {
    render(<App />)
    // Should show today's date in the Header's h1
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Thursday, January 16, 2025",
    )
  })

  it("renders day view for specific date", () => {
    window.location.hash = "#/day/2025-03-15"
    render(<App />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Saturday, March 15, 2025")
  })

  it("renders settings view", () => {
    window.location.hash = "#/settings"
    render(<App />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Settings")
  })

  it("navigates between routes on hash change", async () => {
    render(<App />)

    // Initially shows today's day view (date in Header h1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Thursday, January 16, 2025",
    )

    // Navigate to settings
    act(() => {
      window.location.hash = "#/settings"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Settings")

    // Navigate back to a specific day
    act(() => {
      window.location.hash = "#/day/2025-06-20"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Friday, June 20, 2025")
  })

  it("defaults to today for invalid routes", () => {
    window.location.hash = "#/invalid/route"
    render(<App />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Thursday, January 16, 2025",
    )
  })
})
