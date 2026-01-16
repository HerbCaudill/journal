import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { SettingsView } from "./SettingsView"
import * as JournalContext from "../context/JournalContext"
import type { Doc } from "@automerge/automerge"
import type { JournalDoc } from "../types/journal"

// Mock the useJournal hook
vi.mock("../context/JournalContext", () => ({
  useJournal: vi.fn(),
}))

const mockChangeDoc = vi.fn()

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

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
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
      "https://console.anthropic.com/"
    )
  })

  it("renders Google integration section with disabled button", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    expect(screen.getByRole("heading", { name: /google integration/i })).toBeInTheDocument()
    const googleButton = screen.getByRole("button", { name: /connect google account/i })
    expect(googleButton).toBeDisabled()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
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

  it("shows API key as text by default and toggles visibility", () => {
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })

    render(<SettingsView />)

    const input = screen.getByLabelText(/claude api key/i)
    expect(input).toHaveAttribute("type", "text")

    const toggleButton = screen.getByRole("button", { name: /hide api key/i })
    fireEvent.click(toggleButton)

    expect(input).toHaveAttribute("type", "password")
    expect(screen.getByRole("button", { name: /show api key/i })).toBeInTheDocument()
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
