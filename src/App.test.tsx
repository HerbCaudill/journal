import { render, screen, act, waitFor } from "@testing-library/react"
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

// Store original location for restoration
const originalLocation = window.location

// Mock matchMedia for useTheme hook
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
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
    // Reset pathname and search for OAuth tests
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    })
  })

  it("renders header with today's date by default", () => {
    render(<App />)
    expect(screen.getByRole("banner")).toBeInTheDocument()
  })

  it("renders day view at root", () => {
    render(<App />)
    // Should show today's date in the Header's h1 (with day of week and month/day on separate lines)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday")
    expect(heading).toHaveTextContent("January 16, 2025")
  })

  it("renders day view for specific date", () => {
    window.location.hash = "#/day/2025-03-15"
    render(<App />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Saturday")
    expect(heading).toHaveTextContent("March 15, 2025")
  })

  it("renders settings view", () => {
    window.location.hash = "#/settings"
    render(<App />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Settings")
  })

  it("navigates between routes on hash change", async () => {
    render(<App />)

    // Initially shows today's day view (date in Header h1 with day of week and month/day)
    let heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday")
    expect(heading).toHaveTextContent("January 16, 2025")

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
    heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Friday")
    expect(heading).toHaveTextContent("June 20, 2025")
  })

  it("defaults to today for invalid routes", () => {
    window.location.hash = "#/invalid/route"
    render(<App />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday")
    expect(heading).toHaveTextContent("January 16, 2025")
  })

  describe("OAuth callback", () => {
    it("shows processing state when on OAuth callback route", async () => {
      // Mock location for OAuth callback
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          pathname: "/oauth/callback",
          search: "?code=test-auth-code&state=test-state",
          hash: "",
          href: "http://localhost/oauth/callback?code=test-auth-code&state=test-state",
        },
        writable: true,
      })

      render(<App />)
      expect(screen.getByText("Completing authentication...")).toBeInTheDocument()

      // Wait for async operations to complete to avoid act() warnings
      await waitFor(() => {
        // The component will transition to error state since sessionStorage doesn't have the OAuth state
        expect(
          screen.getByText(/Failed to complete authentication|Invalid OAuth/),
        ).toBeInTheDocument()
      })
    })

    it("falls back to day view when OAuth callback has missing parameters", () => {
      // Mock location for OAuth callback without required params
      // Since code and state are missing, it should NOT be treated as OAuth callback
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          pathname: "/oauth/callback",
          search: "",
          hash: "",
          href: "http://localhost/oauth/callback",
        },
        writable: true,
      })

      render(<App />)

      // Should show the normal day view since params are missing
      const heading = screen.getByRole("heading", { level: 1 })
      expect(heading).toHaveTextContent("Thursday")
      expect(heading).toHaveTextContent("January 16, 2025")
    })

    it("shows error state when OAuth state validation fails", async () => {
      // Mock location for OAuth callback with valid params but state won't match
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          pathname: "/oauth/callback",
          search: "?code=test-code&state=invalid-state",
          hash: "",
          href: "http://localhost/oauth/callback?code=test-code&state=invalid-state",
        },
        writable: true,
      })

      // Clear sessionStorage to simulate state mismatch
      sessionStorage.removeItem("google_oauth_state")
      sessionStorage.removeItem("google_oauth_verifier")

      render(<App />)

      // Should show processing first, then error
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to complete authentication|Invalid OAuth/),
        ).toBeInTheDocument()
      })
    })
  })
})
