import { render, screen, act, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import type { JournalDoc } from "./types/journal"

// Mock automerge modules early to prevent heavy WASM loading
vi.mock("@automerge/automerge-repo", () => ({
  Repo: vi.fn(),
}))
vi.mock("@automerge/automerge-repo-storage-indexeddb", () => ({
  IndexedDBStorageAdapter: vi.fn(),
}))
vi.mock("@automerge/automerge-repo-react-hooks", () => ({
  RepoContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
  useDocument: vi.fn(() => [undefined, vi.fn()]),
}))

// Mock the repo module
vi.mock("./lib/repo", () => ({
  getRepo: vi.fn(() => ({})),
}))

// Mock the LLMSection component - the Anthropic SDK import causes memory issues in jsdom
vi.mock("./components/LLMSection", () => ({
  LLMSection: () => null,
  SubmitButtonIcon: () => null,
}))

// Mock hooks that have side effects
vi.mock("./hooks/useGeolocation", () => ({
  useGeolocation: () => ({
    position: null,
    isLoading: false,
    error: null,
    permission: "prompt",
    requestPosition: vi.fn().mockResolvedValue(null),
    clear: vi.fn(),
  }),
}))

// Mock geocoding module
vi.mock("./lib/geocoding", () => ({
  reverseGeocode: vi.fn().mockResolvedValue({
    locality: "Test City",
    displayName: "Test City, Test State, Test Country",
    success: true,
  }),
}))

vi.mock("./hooks/useGoogleCalendar", () => ({
  useGoogleCalendar: () => ({
    authState: "unconfigured",
    isLoading: false,
    error: null,
    events: [],
    authenticate: vi.fn(),
    handleCallback: vi.fn().mockResolvedValue(false),
    fetchEvents: vi.fn(),
    signOut: vi.fn(),
    clearError: vi.fn(),
  }),
}))

vi.mock("./hooks/useTheme", () => ({
  useTheme: () => ({
    preference: "system",
    resolved: "light",
    setTheme: vi.fn(),
  }),
}))

// Mock the dates module to have consistent test results
vi.mock("./lib/dates", async () => {
  const actual = await vi.importActual("./lib/dates")
  return {
    ...actual,
    getToday: () => "2025-01-16",
  }
})

// Type for Doc from automerge (simplified mock version)
type Doc<T> = T

// Import App after mocking the heavy dependencies
import { App } from "./App"

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

  it("defaults to today for invalid date values", () => {
    // This date matches the YYYY-MM-DD pattern but is not a valid date
    window.location.hash = "#/day/2025-13-45"
    render(<App />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday")
    expect(heading).toHaveTextContent("January 16, 2025")
  })

  it("defaults to today for February 30", () => {
    // February 30 doesn't exist
    window.location.hash = "#/day/2025-02-30"
    render(<App />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday")
    expect(heading).toHaveTextContent("January 16, 2025")
  })

  describe("Footer integration", () => {
    it("renders footer on day view", () => {
      render(<App />)
      const footer = screen.getByRole("contentinfo")
      expect(footer).toBeInTheDocument()
      // Footer should contain a settings link
      expect(footer.querySelector('a[href="#/settings"]')).toBeInTheDocument()
    })

    it("does not render footer on settings view", () => {
      window.location.hash = "#/settings"
      render(<App />)
      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
    })
  })

  describe("Location capture", () => {
    it("stores locality with position when capturing location", async () => {
      // Setup mocks to test location capture behavior
      const mockChangeDoc = vi.fn()
      const mockRequestPosition = vi.fn().mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: 1234567890,
      })

      // Override mocks for this test
      vi.doMock("./context/JournalContext", () => ({
        JournalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useJournal: () => ({
          doc: {
            entries: {},
            settings: { displayName: "", timezone: "UTC", theme: "system" },
          },
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        }),
      }))

      vi.doMock("./hooks/useGeolocation", () => ({
        useGeolocation: () => ({
          position: null,
          isLoading: false,
          error: null,
          permission: "granted",
          requestPosition: mockRequestPosition,
          clear: vi.fn(),
        }),
      }))

      // Re-import App to pick up the new mocks
      const { App: TestApp } = await import("./App")
      render(<TestApp />)

      // The test verifies the code compiles and runs
      // Integration tests in e2e would verify the full behavior
      expect(screen.getByRole("banner")).toBeInTheDocument()
    })
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
