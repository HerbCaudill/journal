import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { SettingsView } from "./SettingsView"
import * as JournalContext from "../context/JournalContext"
import * as GoogleCalendarHook from "../hooks/useGoogleCalendar"
import type { Doc } from "@automerge/automerge"
import type { JournalDoc } from "../types/journal"

// Mock the useJournal hook
vi.mock("../context/JournalContext", () => ({
  useJournal: vi.fn(),
}))

// Mock the useGoogleCalendar hook
vi.mock("../hooks/useGoogleCalendar", () => ({
  useGoogleCalendar: vi.fn(),
}))

const mockChangeDoc = vi.fn()
const mockAuthenticate = vi.fn()
const mockSignOut = vi.fn()
const mockClearError = vi.fn()

const createMockDoc = (claudeApiKey = ""): Doc<JournalDoc> =>
  ({
    entries: {},
    settings: {
      displayName: "",
      timezone: "America/New_York",
      theme: "system",
      claudeApiKey,
    },
  }) as Doc<JournalDoc>

const createMockGoogleCalendar = (
  authState:
    | "unconfigured"
    | "unauthenticated"
    | "authenticating"
    | "authenticated" = "unconfigured",
  error: string | null = null,
) => ({
  authState,
  isLoading: false,
  error,
  events: [],
  authenticate: mockAuthenticate,
  handleCallback: vi.fn(),
  fetchEvents: vi.fn(),
  signOut: mockSignOut,
  clearError: mockClearError,
})

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Default to unconfigured state for most tests
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(createMockGoogleCalendar())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the settings page title", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Settings")
  })

  it("shows loading state when document is loading", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: undefined,
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: true,
    })

    render(<SettingsView />)

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Settings")
    // Should show loading placeholder
    const loadingElement = document.querySelector(".animate-pulse")
    expect(loadingElement).toBeInTheDocument()
  })

  it("renders Claude API key section", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    expect(screen.getByRole("heading", { name: /claude ai/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/claude api key/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /console.anthropic.com/i })).toHaveAttribute(
      "href",
      "https://console.anthropic.com/",
    )
  })

  it("renders Google integration section with unconfigured message when not configured", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("unconfigured"),
    )

    render(<SettingsView />)

    expect(screen.getByRole("heading", { name: /google integration/i })).toBeInTheDocument()
    expect(screen.getByText(/not configured/i)).toBeInTheDocument()
  })

  it("renders Connect button when Google is configured but not authenticated", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("unauthenticated"),
    )

    render(<SettingsView />)

    const googleButton = screen.getByRole("button", { name: /connect google account/i })
    expect(googleButton).not.toBeDisabled()
  })

  it("calls authenticate when Connect button is clicked", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("unauthenticated"),
    )

    render(<SettingsView />)

    const googleButton = screen.getByRole("button", { name: /connect google account/i })
    fireEvent.click(googleButton)

    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
  })

  it("shows connected status when authenticated", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("authenticated"),
    )

    render(<SettingsView />)

    expect(screen.getByText(/google account connected/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument()
  })

  it("calls signOut when Disconnect button is clicked", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("authenticated"),
    )

    render(<SettingsView />)

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i })
    fireEvent.click(disconnectButton)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it("shows connecting state during authentication", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("authenticating"),
    )

    render(<SettingsView />)

    const connectingButton = screen.getByRole("button", { name: /connecting/i })
    expect(connectingButton).toBeDisabled()
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  it("displays Google error message when present", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(
      createMockGoogleCalendar("unauthenticated", "Authentication failed"),
    )

    render(<SettingsView />)

    expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
  })

  it("renders back link to journal", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const backLink = screen.getByRole("link", { name: /back to journal/i })
    expect(backLink).toHaveAttribute("href", "#/")
  })

  it("shows API key as masked password field by default", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    expect(input).toHaveAttribute("type", "password")
  })

  it("toggles API key visibility when show/hide button is clicked", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc("sk-ant-test-key"),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    expect(input).toHaveAttribute("type", "password")

    // Show button should be visible when there's an API key
    const showButton = screen.getByRole("button", { name: /show api key/i })
    fireEvent.click(showButton)

    // After clicking, the input type should be text
    expect(input).toHaveAttribute("type", "text")

    // Hide button should now be visible
    const hideButton = screen.getByRole("button", { name: /hide api key/i })
    fireEvent.click(hideButton)

    // After clicking hide, the input type should be password again
    expect(input).toHaveAttribute("type", "password")
  })

  it("displays security warning notice", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    expect(screen.getByText(/security notice/i)).toBeInTheDocument()
    expect(screen.getByText(/your api key is stored locally in your browser/i)).toBeInTheDocument()
  })

  it("loads existing API key from document", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc("sk-ant-test-key"),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i) as HTMLInputElement
    expect(input.value).toBe("sk-ant-test-key")
    expect(screen.getByText(/api key configured/i)).toBeInTheDocument()
  })

  it("saves API key when form is submitted", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    fireEvent.change(input, { target: { value: "sk-ant-new-key" } })

    const saveButton = screen.getByRole("button", { name: /save/i })
    fireEvent.click(saveButton)

    expect(mockChangeDoc).toHaveBeenCalledTimes(1)
  })

  it("disables save button when there are no unsaved changes", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc("sk-ant-existing"),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const saveButton = screen.getByRole("button", { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it("enables save button when API key is changed", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc("sk-ant-existing"),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    fireEvent.change(input, { target: { value: "sk-ant-new-key" } })

    const saveButton = screen.getByRole("button", { name: /save/i })
    expect(saveButton).not.toBeDisabled()
  })

  it("shows clear button when API key exists", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    fireEvent.change(input, { target: { value: "sk-ant-test" } })

    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
  })

  it("clears API key when clear button is clicked", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc("sk-ant-existing"),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const clearButton = screen.getByRole("button", { name: /clear/i })
    fireEvent.click(clearButton)

    const input = screen.getByLabelText(/claude api key/i) as HTMLInputElement
    expect(input.value).toBe("")
    expect(mockChangeDoc).toHaveBeenCalledTimes(1)
  })

  it("shows saved confirmation after saving", async () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    fireEvent.change(input, { target: { value: "sk-ant-new-key" } })

    const saveButton = screen.getByRole("button", { name: /save/i })
    fireEvent.click(saveButton)

    expect(screen.getByText(/api key saved successfully/i)).toBeInTheDocument()

    // Confirmation should disappear after timeout
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText(/api key saved successfully/i)).not.toBeInTheDocument()
  })
})
