import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { SettingsView, validateClaudeApiKey, validateOpenaiApiKey } from "./SettingsView"
import * as JournalContext from "../context/JournalContext"
import * as GoogleCalendarHook from "../hooks/useGoogleCalendar"
import * as ThemeHook from "../hooks/useTheme"
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

// Mock the useTheme hook
vi.mock("../hooks/useTheme", () => ({
  useTheme: vi.fn(),
}))

const mockChangeDoc = vi.fn()
const mockAuthenticate = vi.fn()
const mockSignOut = vi.fn()
const mockClearError = vi.fn()
const mockSetTheme = vi.fn()

const createMockDoc = (
  claudeApiKey = "",
  llmProvider: "claude" | "openai" = "claude",
): Doc<JournalDoc> =>
  ({
    entries: {},
    settings: {
      displayName: "",
      timezone: "America/New_York",
      theme: "system",
      llmProvider,
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

const createMockTheme = (preference: "light" | "dark" | "system" = "system") => ({
  preference,
  resolved: preference === "system" ? "light" : preference,
  setTheme: mockSetTheme,
})

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Default to unconfigured state for most tests
    vi.mocked(GoogleCalendarHook.useGoogleCalendar).mockReturnValue(createMockGoogleCalendar())
    // Default to system theme
    vi.mocked(ThemeHook.useTheme).mockReturnValue(createMockTheme())
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

  it("renders Claude API key section when Claude is selected", () => {
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
    // OpenAI section should not be visible when Claude is selected
    expect(screen.queryByRole("heading", { name: /openai$/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/openai api key/i)).not.toBeInTheDocument()
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

  it("shows API key as plain text input", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    expect(input).toHaveAttribute("type", "text")
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
    expect(
      screen.getByText(/your api keys are stored locally in your browser/i),
    ).toBeInTheDocument()
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

  it("autosaves API key after typing", async () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    // Wait for initial load flag to be cleared
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    const input = screen.getByLabelText(/claude api key/i)
    fireEvent.change(input, { target: { value: "sk-ant-api03-validkey1234567890" } })

    // Should show saving status
    expect(screen.getByTestId("claude-api-key-save-status")).toHaveTextContent("Saving...")

    // Advance timers to trigger debounced save
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(mockChangeDoc).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("claude-api-key-save-status")).toHaveTextContent("Saved")
  })

  it("shows configured status when API key is set", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc("sk-ant-existing-key-12345"),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    expect(screen.getByText(/claude api key configured/i)).toBeInTheDocument()
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

  it("shows saved confirmation after autosave and then hides it", async () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    // Wait for initial load flag to be cleared
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    const input = screen.getByLabelText(/claude api key/i)
    fireEvent.change(input, { target: { value: "sk-ant-api03-validkey1234567890" } })

    // Advance timers to trigger debounced save
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByTestId("claude-api-key-save-status")).toHaveTextContent("Saved")

    // Confirmation should disappear after timeout
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId("claude-api-key-save-status")).not.toBeInTheDocument()
  })

  // Note: LLM Provider selection tests and OpenAI API key section tests are commented out
  // because the OpenAI UI is hidden until functionality is wired up (j-3q0)
  // TODO: Uncomment when OpenAI functionality is implemented
  /*
  describe("LLM Provider selection", () => {
    it("renders AI Provider section", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      expect(screen.getByRole("heading", { name: /ai provider/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /claude/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument()
    })

    it("shows Claude as selected by default", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      const claudeButton = screen.getByRole("button", { name: /claude/i })
      expect(claudeButton).toHaveAttribute("aria-pressed", "true")

      const openaiButton = screen.getByRole("button", { name: /openai/i })
      expect(openaiButton).toHaveAttribute("aria-pressed", "false")
    })

    it("changes provider when OpenAI button is clicked", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      const openaiButton = screen.getByRole("button", { name: /openai/i })
      fireEvent.click(openaiButton)

      expect(mockChangeDoc).toHaveBeenCalledTimes(1)
    })

    it("shows OpenAI as selected when llmProvider is openai", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("", "openai"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      const claudeButton = screen.getByRole("button", { name: /claude/i })
      expect(claudeButton).toHaveAttribute("aria-pressed", "false")

      const openaiButton = screen.getByRole("button", { name: /openai/i })
      expect(openaiButton).toHaveAttribute("aria-pressed", "true")
    })
  })

  describe("OpenAI API key section", () => {
    it("renders OpenAI API key section when OpenAI is selected", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("", "openai"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      expect(screen.getByRole("heading", { name: /openai$/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /platform.openai.com/i })).toHaveAttribute(
        "href",
        "https://platform.openai.com/api-keys",
      )
      // Claude section should not be visible when OpenAI is selected
      expect(screen.queryByRole("heading", { name: /claude ai/i })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/claude api key/i)).not.toBeInTheDocument()
    })

    it("saves OpenAI API key when form is submitted", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("", "openai"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      const input = screen.getByLabelText(/openai api key/i)
      fireEvent.change(input, { target: { value: "sk-proj-validkey1234567890" } })

      // Find the save button that's in the form containing the OpenAI API key input
      const form = input.closest("form")!
      const saveButton = form.querySelector('button[type="submit"]')!
      fireEvent.click(saveButton)

      expect(mockChangeDoc).toHaveBeenCalledTimes(1)
    })
  })
  */

  // Note: Environment variable defaults (VITE_CLAUDE_API_KEY, VITE_OPENAI_API_KEY) are tested
  // manually since import.meta.env is evaluated at module load time, making unit testing complex.
  // The implementation uses env vars as fallbacks when no saved value exists in document settings.

  describe("Theme selection", () => {
    it("renders Theme section with all options", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      expect(screen.getByRole("heading", { name: /^theme$/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /light/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /system/i })).toBeInTheDocument()
    })

    it("shows System as selected by default", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })
      vi.mocked(ThemeHook.useTheme).mockReturnValue(createMockTheme("system"))

      render(<SettingsView />)

      const systemButton = screen.getByRole("button", { name: /system/i })
      expect(systemButton).toHaveAttribute("aria-pressed", "true")

      const lightButton = screen.getByRole("button", { name: /light/i })
      expect(lightButton).toHaveAttribute("aria-pressed", "false")

      const darkButton = screen.getByRole("button", { name: /dark/i })
      expect(darkButton).toHaveAttribute("aria-pressed", "false")
    })

    it("shows Light as selected when preference is light", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })
      vi.mocked(ThemeHook.useTheme).mockReturnValue(createMockTheme("light"))

      render(<SettingsView />)

      const lightButton = screen.getByRole("button", { name: /light/i })
      expect(lightButton).toHaveAttribute("aria-pressed", "true")
    })

    it("shows Dark as selected when preference is dark", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })
      vi.mocked(ThemeHook.useTheme).mockReturnValue(createMockTheme("dark"))

      render(<SettingsView />)

      const darkButton = screen.getByRole("button", { name: /dark/i })
      expect(darkButton).toHaveAttribute("aria-pressed", "true")
    })

    it("calls setTheme with 'light' when Light button is clicked", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      const lightButton = screen.getByRole("button", { name: /light/i })
      fireEvent.click(lightButton)

      expect(mockSetTheme).toHaveBeenCalledWith("light")
    })

    it("calls setTheme with 'dark' when Dark button is clicked", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      const darkButton = screen.getByRole("button", { name: /dark/i })
      fireEvent.click(darkButton)

      expect(mockSetTheme).toHaveBeenCalledWith("dark")
    })

    it("calls setTheme with 'system' when System button is clicked", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })
      vi.mocked(ThemeHook.useTheme).mockReturnValue(createMockTheme("dark"))

      render(<SettingsView />)

      const systemButton = screen.getByRole("button", { name: /system/i })
      fireEvent.click(systemButton)

      expect(mockSetTheme).toHaveBeenCalledWith("system")
    })

    it("displays theme description text", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc(),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      render(<SettingsView />)

      expect(screen.getByText(/choose your preferred color scheme/i)).toBeInTheDocument()
    })
  })

  describe("API key validation", () => {
    describe("validateClaudeApiKey", () => {
      it("returns null for empty string (allowed)", () => {
        expect(validateClaudeApiKey("")).toBeNull()
        expect(validateClaudeApiKey("   ")).toBeNull()
      })

      it("returns null for valid Claude API key", () => {
        expect(validateClaudeApiKey("sk-ant-api03-validkey12345678")).toBeNull()
        expect(validateClaudeApiKey("sk-ant-test-1234567890abcdef")).toBeNull()
      })

      it("returns error for key not starting with sk-ant-", () => {
        expect(validateClaudeApiKey("invalid-key")).toBe(
          "Claude API key should start with 'sk-ant-'",
        )
        expect(validateClaudeApiKey("sk-openai-key12345")).toBe(
          "Claude API key should start with 'sk-ant-'",
        )
      })

      it("returns error for key that is too short", () => {
        expect(validateClaudeApiKey("sk-ant-short")).toBe("Claude API key appears to be too short")
      })
    })

    describe("validateOpenaiApiKey", () => {
      it("returns null for empty string (allowed)", () => {
        expect(validateOpenaiApiKey("")).toBeNull()
        expect(validateOpenaiApiKey("   ")).toBeNull()
      })

      it("returns null for valid OpenAI API key", () => {
        expect(validateOpenaiApiKey("sk-proj-validkey123456789")).toBeNull()
        expect(validateOpenaiApiKey("sk-test-12345678901234567890")).toBeNull()
      })

      it("returns error for key not starting with sk-", () => {
        expect(validateOpenaiApiKey("invalid-key")).toBe("OpenAI API key should start with 'sk-'")
        expect(validateOpenaiApiKey("api-key-12345678")).toBe(
          "OpenAI API key should start with 'sk-'",
        )
      })

      it("returns error when Claude key is entered for OpenAI", () => {
        expect(validateOpenaiApiKey("sk-ant-api03-somekey")).toBe(
          "This appears to be a Claude API key, not an OpenAI key",
        )
      })

      it("returns error for key that is too short", () => {
        expect(validateOpenaiApiKey("sk-short")).toBe("OpenAI API key appears to be too short")
      })
    })

    describe("Claude API key validation UI", () => {
      it("shows validation error when autosaving invalid Claude API key", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const input = screen.getByLabelText(/claude api key/i)
        fireEvent.change(input, { target: { value: "invalid-key" } })

        // Advance timers to trigger debounced save and validation
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(screen.getByRole("alert")).toHaveTextContent(
          "Claude API key should start with 'sk-ant-'",
        )
        expect(mockChangeDoc).not.toHaveBeenCalled()
      })

      it("shows validation error for short Claude API key", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const input = screen.getByLabelText(/claude api key/i)
        fireEvent.change(input, { target: { value: "sk-ant-short" } })

        // Advance timers to trigger debounced save and validation
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(screen.getByRole("alert")).toHaveTextContent(
          "Claude API key appears to be too short",
        )
        expect(mockChangeDoc).not.toHaveBeenCalled()
      })

      it("clears validation error when user types", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const input = screen.getByLabelText(/claude api key/i)
        fireEvent.change(input, { target: { value: "invalid-key" } })

        // Advance timers to trigger debounced save and validation
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(screen.getByRole("alert")).toBeInTheDocument()

        // Type to clear the error - error should clear immediately on typing
        fireEvent.change(input, { target: { value: "sk-ant-" } })

        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      })

      it("autosaves valid Claude API key successfully", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const input = screen.getByLabelText(/claude api key/i)
        fireEvent.change(input, { target: { value: "sk-ant-api03-validkey12345678" } })

        // Advance timers to trigger debounced save
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        expect(mockChangeDoc).toHaveBeenCalledTimes(1)
      })

      it("sets aria-invalid on input when validation fails", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const input = screen.getByLabelText(/claude api key/i)
        fireEvent.change(input, { target: { value: "invalid-key" } })

        // Advance timers to trigger debounced save and validation
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(input).toHaveAttribute("aria-invalid", "true")
      })
    })

    describe("Bio and Additional Instructions", () => {
      it("renders bio section with textarea", () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        expect(screen.getByRole("heading", { name: /about you/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/bio/i)).toBeInTheDocument()
      })

      it("renders additional instructions section with textarea", () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        expect(
          screen.getByRole("heading", { name: /additional instructions/i }),
        ).toBeInTheDocument()
        expect(screen.getByLabelText(/additional instructions/i)).toBeInTheDocument()
      })

      it("loads existing bio from document", () => {
        const mockDoc = createMockDoc()
        mockDoc.settings.bio = "I am a software engineer"
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: mockDoc,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        const bioInput = screen.getByLabelText(/bio/i) as HTMLTextAreaElement
        expect(bioInput.value).toBe("I am a software engineer")
      })

      it("loads existing additional instructions from document", () => {
        const mockDoc = createMockDoc()
        mockDoc.settings.additionalInstructions = "Always be concise"
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: mockDoc,
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        const instructionsInput = screen.getByLabelText(
          /additional instructions/i,
        ) as HTMLTextAreaElement
        expect(instructionsInput.value).toBe("Always be concise")
      })

      it("autosaves bio when typing", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const bioInput = screen.getByLabelText(/bio/i)
        fireEvent.change(bioInput, { target: { value: "I love coding" } })

        // Should show saving status
        expect(screen.getByTestId("bio-save-status")).toHaveTextContent("Saving...")

        // Advance timers to trigger debounced save
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(mockChangeDoc).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId("bio-save-status")).toHaveTextContent("Saved")
      })

      it("autosaves additional instructions when typing", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const instructionsInput = screen.getByLabelText(/additional instructions/i)
        fireEvent.change(instructionsInput, { target: { value: "Be friendly" } })

        // Should show saving status
        expect(screen.getByTestId("instructions-save-status")).toHaveTextContent("Saving...")

        // Advance timers to trigger debounced save
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(mockChangeDoc).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId("instructions-save-status")).toHaveTextContent("Saved")
      })

      it("hides save status after timeout", async () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc(),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        // Wait for initial load flag to be cleared
        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        const bioInput = screen.getByLabelText(/bio/i)
        fireEvent.change(bioInput, { target: { value: "New bio" } })

        // Advance timers to trigger debounced save
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(screen.getByTestId("bio-save-status")).toHaveTextContent("Saved")

        // Advance timers to hide the status
        await act(async () => {
          vi.advanceTimersByTime(2000)
        })

        expect(screen.queryByTestId("bio-save-status")).not.toBeInTheDocument()
      })
    })

    // Note: OpenAI API key validation UI tests are commented out because the
    // OpenAI UI is hidden until functionality is wired up (j-3q0)
    // TODO: Uncomment when OpenAI functionality is implemented
    /*
    describe("OpenAI API key validation UI", () => {
      it("shows validation error when saving invalid OpenAI API key", () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc("", "openai"),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        const input = screen.getByLabelText(/openai api key/i)
        fireEvent.change(input, { target: { value: "invalid-key" } })

        // Find the save button that's in the form containing the OpenAI API key input
        const form = input.closest("form")!
        const saveButton = form.querySelector('button[type="submit"]')!
        fireEvent.click(saveButton)

        expect(screen.getByRole("alert")).toHaveTextContent(
          "OpenAI API key should start with 'sk-'",
        )
        expect(mockChangeDoc).not.toHaveBeenCalled()
      })

      it("shows error when entering Claude key in OpenAI field", () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc("", "openai"),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        const input = screen.getByLabelText(/openai api key/i)
        fireEvent.change(input, { target: { value: "sk-ant-api03-somekey" } })

        // Find the save button that's in the form containing the OpenAI API key input
        const form = input.closest("form")!
        const saveButton = form.querySelector('button[type="submit"]')!
        fireEvent.click(saveButton)

        expect(screen.getByRole("alert")).toHaveTextContent(
          "This appears to be a Claude API key, not an OpenAI key",
        )
        expect(mockChangeDoc).not.toHaveBeenCalled()
      })

      it("saves valid OpenAI API key successfully", () => {
        vi.mocked(JournalContext.useJournal).mockReturnValue({
          doc: createMockDoc("", "openai"),
          changeDoc: mockChangeDoc,
          handle: undefined,
          isLoading: false,
        })

        render(<SettingsView />)

        const input = screen.getByLabelText(/openai api key/i)
        fireEvent.change(input, { target: { value: "sk-proj-validkey12345678901234567890" } })

        // Find the save button that's in the form containing the OpenAI API key input
        const form = input.closest("form")!
        const saveButton = form.querySelector('button[type="submit"]')!
        fireEvent.click(saveButton)

        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        expect(mockChangeDoc).toHaveBeenCalledTimes(1)
      })
    })
    */
  })
})
