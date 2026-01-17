import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTheme } from "./useTheme"
import * as JournalContext from "../context/JournalContext"
import type { JournalDoc } from "../types/journal"
import type { Doc } from "@automerge/automerge"

// Mock the useJournal hook
vi.mock("../context/JournalContext", () => ({
  useJournal: vi.fn(),
}))

const mockChangeDoc = vi.fn()

const createMockDoc = (theme: "light" | "dark" | "system" = "system"): Doc<JournalDoc> =>
  ({
    entries: {},
    settings: {
      displayName: "Test User",
      timezone: "America/New_York",
      theme,
      llmProvider: "claude",
    },
  }) as Doc<JournalDoc>

describe("useTheme", () => {
  let originalMatchMedia: typeof window.matchMedia
  let mockMediaQueryList: {
    matches: boolean
    media: string
    onchange: null
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    addListener: ReturnType<typeof vi.fn>
    removeListener: ReturnType<typeof vi.fn>
    dispatchEvent: ReturnType<typeof vi.fn>
  }
  let changeListeners: Array<(e: MediaQueryListEvent) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset listeners
    changeListeners = []

    // Mock matchMedia
    originalMatchMedia = window.matchMedia
    mockMediaQueryList = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn((event, listener) => {
        if (event === "change") {
          changeListeners.push(listener as (e: MediaQueryListEvent) => void)
        }
      }),
      removeEventListener: vi.fn((event, listener) => {
        if (event === "change") {
          changeListeners = changeListeners.filter(l => l !== listener)
        }
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList)

    // Clean up document classes
    document.documentElement.classList.remove("dark")

    // Default mock for useJournal
    vi.mocked(JournalContext.useJournal).mockReturnValue({
      doc: createMockDoc(),
      changeDoc: mockChangeDoc,
      handle: undefined,
      isLoading: false,
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    document.documentElement.classList.remove("dark")
  })

  describe("initial theme application", () => {
    it("applies light theme when preference is 'light'", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("light"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })

    it("applies dark theme when preference is 'dark'", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("dark"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    it("applies system theme (light) when preference is 'system' and system prefers light", () => {
      mockMediaQueryList.matches = false
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })

    it("applies system theme (dark) when preference is 'system' and system prefers dark", () => {
      mockMediaQueryList.matches = true
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })
  })

  describe("return values", () => {
    it("returns current preference from settings", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("dark"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.preference).toBe("dark")
    })

    it("returns resolved theme for light preference", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("light"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.resolved).toBe("light")
    })

    it("returns resolved theme for dark preference", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("dark"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.resolved).toBe("dark")
    })

    it("returns resolved theme based on system preference", () => {
      mockMediaQueryList.matches = true
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.preference).toBe("system")
      expect(result.current.resolved).toBe("dark")
    })

    it("provides setTheme function", () => {
      const { result } = renderHook(() => useTheme())

      expect(typeof result.current.setTheme).toBe("function")
    })
  })

  describe("theme changes", () => {
    it("calls changeDoc when setTheme is called with 'dark'", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("dark")
      })

      expect(mockChangeDoc).toHaveBeenCalledTimes(1)
    })

    it("calls changeDoc when setTheme is called with 'light'", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("dark"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("light")
      })

      expect(mockChangeDoc).toHaveBeenCalledTimes(1)
    })

    it("calls changeDoc when setTheme is called with 'system'", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("light"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("system")
      })

      expect(mockChangeDoc).toHaveBeenCalledTimes(1)
    })
  })

  describe("system preference changes", () => {
    it("listens for system preference changes when using system theme", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      )
    })

    it("does not listen for system preference changes when using fixed theme", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("dark"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(mockMediaQueryList.addEventListener).not.toHaveBeenCalled()
    })

    it("updates theme when system preference changes to dark", () => {
      mockMediaQueryList.matches = false
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(false)

      // Simulate system preference change
      act(() => {
        changeListeners.forEach(listener => {
          listener({ matches: true } as MediaQueryListEvent)
        })
      })

      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    it("updates theme when system preference changes to light", () => {
      mockMediaQueryList.matches = true
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(true)

      // Simulate system preference change
      act(() => {
        changeListeners.forEach(listener => {
          listener({ matches: false } as MediaQueryListEvent)
        })
      })

      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })

    it("cleans up event listener on unmount", () => {
      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("system"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { unmount } = renderHook(() => useTheme())

      unmount()

      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      )
    })
  })

  describe("default theme", () => {
    it("defaults to system theme when settings.theme is undefined", () => {
      const mockDocWithoutTheme = {
        entries: {},
        settings: {
          displayName: "Test User",
          timezone: "America/New_York",
          llmProvider: "claude",
        },
      } as Doc<JournalDoc>

      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: mockDocWithoutTheme,
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.preference).toBe("system")
    })
  })

  describe("removes dark class correctly", () => {
    it("removes dark class when switching from dark to light", () => {
      document.documentElement.classList.add("dark")

      vi.mocked(JournalContext.useJournal).mockReturnValue({
        doc: createMockDoc("light"),
        changeDoc: mockChangeDoc,
        handle: undefined,
        isLoading: false,
      })

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })
  })
})
