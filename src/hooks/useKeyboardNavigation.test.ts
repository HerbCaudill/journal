import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useKeyboardNavigation } from "./useKeyboardNavigation"

// Helper to create and dispatch keyboard events
function dispatchKeyDown(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, "target", { value: target, writable: false })
  window.dispatchEvent(event)
  return event
}

// Helper to create a mock element
function createMockElement(tagName: string, isContentEditable = false): HTMLElement {
  const element = document.createElement(tagName)
  if (isContentEditable) {
    element.contentEditable = "true"
  }
  return element
}

describe("useKeyboardNavigation", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("calls onPrevious when left arrow key is pressed", () => {
    const onPrevious = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious }))

    dispatchKeyDown("ArrowLeft")

    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it("calls onNext when right arrow key is pressed", () => {
    const onNext = vi.fn()
    renderHook(() => useKeyboardNavigation({ onNext }))

    dispatchKeyDown("ArrowRight")

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("calls onPrevious when lowercase 'p' key is pressed", () => {
    const onPrevious = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious }))

    dispatchKeyDown("p")

    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it("calls onPrevious when uppercase 'P' key is pressed", () => {
    const onPrevious = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious }))

    dispatchKeyDown("P")

    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it("calls onNext when lowercase 'n' key is pressed", () => {
    const onNext = vi.fn()
    renderHook(() => useKeyboardNavigation({ onNext }))

    dispatchKeyDown("n")

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("calls onNext when uppercase 'N' key is pressed", () => {
    const onNext = vi.fn()
    renderHook(() => useKeyboardNavigation({ onNext }))

    dispatchKeyDown("N")

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("calls onToday when lowercase 't' key is pressed", () => {
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onToday }))

    dispatchKeyDown("t")

    expect(onToday).toHaveBeenCalledTimes(1)
  })

  it("calls onToday when uppercase 'T' key is pressed", () => {
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onToday }))

    dispatchKeyDown("T")

    expect(onToday).toHaveBeenCalledTimes(1)
  })

  it("does not call callbacks for other keys", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext }))

    dispatchKeyDown("ArrowUp")
    dispatchKeyDown("ArrowDown")
    dispatchKeyDown("Enter")
    dispatchKeyDown("a")

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it("does not call callbacks when focus is in an input element", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext, onToday }))

    const input = createMockElement("INPUT")
    dispatchKeyDown("ArrowLeft", input)
    dispatchKeyDown("ArrowRight", input)
    dispatchKeyDown("t", input)
    dispatchKeyDown("p", input)
    dispatchKeyDown("n", input)

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(onToday).not.toHaveBeenCalled()
  })

  it("does not call callbacks when focus is in a textarea element", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext, onToday }))

    const textarea = createMockElement("TEXTAREA")
    dispatchKeyDown("ArrowLeft", textarea)
    dispatchKeyDown("ArrowRight", textarea)
    dispatchKeyDown("t", textarea)
    dispatchKeyDown("p", textarea)
    dispatchKeyDown("n", textarea)

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(onToday).not.toHaveBeenCalled()
  })

  it("does not call callbacks when focus is in a contenteditable element", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext, onToday }))

    const editable = createMockElement("DIV", true)
    dispatchKeyDown("ArrowLeft", editable)
    dispatchKeyDown("ArrowRight", editable)
    dispatchKeyDown("t", editable)
    dispatchKeyDown("p", editable)
    dispatchKeyDown("n", editable)

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(onToday).not.toHaveBeenCalled()
  })

  it("can be disabled via enabled option", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext, onToday, enabled: false }))

    dispatchKeyDown("ArrowLeft")
    dispatchKeyDown("ArrowRight")
    dispatchKeyDown("t")
    dispatchKeyDown("p")
    dispatchKeyDown("n")

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(onToday).not.toHaveBeenCalled()
  })

  it("handles missing callbacks gracefully", () => {
    renderHook(() => useKeyboardNavigation({}))

    // Should not throw when no callbacks provided
    expect(() => {
      dispatchKeyDown("ArrowLeft")
      dispatchKeyDown("ArrowRight")
      dispatchKeyDown("t")
      dispatchKeyDown("p")
      dispatchKeyDown("n")
    }).not.toThrow()
  })

  it("does not call callbacks when focus is in a nested element inside contentEditable", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext, onToday }))

    // Create a contentEditable parent with a nested child
    const parent = document.createElement("DIV")
    parent.contentEditable = "true"
    const child = document.createElement("SPAN")
    // Child inherits contentEditable from parent (contentEditable="inherit" is the default)
    parent.appendChild(child)
    document.body.appendChild(parent)

    dispatchKeyDown("ArrowLeft", child)
    dispatchKeyDown("ArrowRight", child)
    dispatchKeyDown("t", child)
    dispatchKeyDown("p", child)
    dispatchKeyDown("n", child)

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(onToday).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(parent)
  })

  it("allows navigation when contentEditable=false overrides parent contentEditable=true", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious, onNext }))

    // Create a contentEditable parent with a non-editable child
    const parent = document.createElement("DIV")
    parent.contentEditable = "true"
    const child = document.createElement("SPAN")
    child.contentEditable = "false"
    parent.appendChild(child)
    document.body.appendChild(parent)

    dispatchKeyDown("ArrowLeft", child)
    dispatchKeyDown("ArrowRight", child)

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)

    // Cleanup
    document.body.removeChild(parent)
  })

  it("does not call callbacks for deeply nested element inside contentEditable", () => {
    const onPrevious = vi.fn()
    renderHook(() => useKeyboardNavigation({ onPrevious }))

    // Create a deeply nested structure
    const grandparent = document.createElement("DIV")
    grandparent.contentEditable = "true"
    const parent = document.createElement("DIV")
    const child = document.createElement("SPAN")
    grandparent.appendChild(parent)
    parent.appendChild(child)
    document.body.appendChild(grandparent)

    dispatchKeyDown("ArrowLeft", child)

    expect(onPrevious).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(grandparent)
  })

  it("cleans up event listener on unmount", () => {
    const onPrevious = vi.fn()
    const { unmount } = renderHook(() => useKeyboardNavigation({ onPrevious }))

    unmount()

    dispatchKeyDown("ArrowLeft")

    expect(onPrevious).not.toHaveBeenCalled()
  })

  it("updates event listener when callbacks change", () => {
    const onPrevious1 = vi.fn()
    const onPrevious2 = vi.fn()
    const { rerender } = renderHook(({ onPrevious }) => useKeyboardNavigation({ onPrevious }), {
      initialProps: { onPrevious: onPrevious1 },
    })

    dispatchKeyDown("ArrowLeft")
    expect(onPrevious1).toHaveBeenCalledTimes(1)

    rerender({ onPrevious: onPrevious2 })

    dispatchKeyDown("ArrowLeft")
    expect(onPrevious1).toHaveBeenCalledTimes(1) // Not called again
    expect(onPrevious2).toHaveBeenCalledTimes(1)
  })

  describe("state transitions", () => {
    describe("rapid navigation", () => {
      it("handles rapid consecutive key presses", () => {
        const onPrevious = vi.fn()
        const onNext = vi.fn()
        renderHook(() => useKeyboardNavigation({ onPrevious, onNext }))

        // Rapid consecutive presses
        dispatchKeyDown("ArrowLeft")
        dispatchKeyDown("ArrowLeft")
        dispatchKeyDown("ArrowLeft")
        dispatchKeyDown("ArrowRight")
        dispatchKeyDown("ArrowRight")

        // All presses should be registered
        expect(onPrevious).toHaveBeenCalledTimes(3)
        expect(onNext).toHaveBeenCalledTimes(2)
      })

      it("handles alternating between navigation keys rapidly", () => {
        const onPrevious = vi.fn()
        const onNext = vi.fn()
        const onToday = vi.fn()
        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, onToday }))

        // Alternate between all navigation keys
        dispatchKeyDown("ArrowLeft")
        dispatchKeyDown("t")
        dispatchKeyDown("ArrowRight")
        dispatchKeyDown("p")
        dispatchKeyDown("T")
        dispatchKeyDown("n")

        expect(onPrevious).toHaveBeenCalledTimes(2) // ArrowLeft and p
        expect(onNext).toHaveBeenCalledTimes(2) // ArrowRight and n
        expect(onToday).toHaveBeenCalledTimes(2) // t and T
      })
    })

    describe("enabled state changes", () => {
      it("stops responding to keys when disabled mid-session", () => {
        const onPrevious = vi.fn()
        const { rerender } = renderHook(
          ({ enabled }) => useKeyboardNavigation({ onPrevious, enabled }),
          { initialProps: { enabled: true } },
        )

        // First key press should work
        dispatchKeyDown("ArrowLeft")
        expect(onPrevious).toHaveBeenCalledTimes(1)

        // Disable the hook
        rerender({ enabled: false })

        // Key presses should be ignored now
        dispatchKeyDown("ArrowLeft")
        dispatchKeyDown("ArrowLeft")
        expect(onPrevious).toHaveBeenCalledTimes(1) // Still just 1
      })

      it("resumes responding to keys when re-enabled", () => {
        const onNext = vi.fn()
        const { rerender } = renderHook(
          ({ enabled }) => useKeyboardNavigation({ onNext, enabled }),
          { initialProps: { enabled: false } },
        )

        // Initially disabled - no response
        dispatchKeyDown("ArrowRight")
        expect(onNext).toHaveBeenCalledTimes(0)

        // Enable the hook
        rerender({ enabled: true })

        // Now should respond
        dispatchKeyDown("ArrowRight")
        expect(onNext).toHaveBeenCalledTimes(1)
      })

      it("handles rapid enable/disable toggling", () => {
        const onPrevious = vi.fn()
        const { rerender } = renderHook(
          ({ enabled }) => useKeyboardNavigation({ onPrevious, enabled }),
          { initialProps: { enabled: true } },
        )

        // Toggle rapidly
        rerender({ enabled: false })
        rerender({ enabled: true })
        rerender({ enabled: false })
        rerender({ enabled: true })

        // Should respond when finally enabled
        dispatchKeyDown("ArrowLeft")
        expect(onPrevious).toHaveBeenCalledTimes(1)
      })
    })

    describe("callback changes during operation", () => {
      it("uses latest callback when navigation key is pressed", () => {
        const onPrevious1 = vi.fn()
        const onPrevious2 = vi.fn()

        const { rerender } = renderHook(({ onPrevious }) => useKeyboardNavigation({ onPrevious }), {
          initialProps: { onPrevious: onPrevious1 },
        })

        // Update callback
        rerender({ onPrevious: onPrevious2 })

        // Only the new callback should be called
        dispatchKeyDown("ArrowLeft")
        expect(onPrevious1).not.toHaveBeenCalled()
        expect(onPrevious2).toHaveBeenCalledTimes(1)
      })

      it("handles callback being set to undefined", () => {
        const onPrevious = vi.fn()

        const { rerender } = renderHook(({ onPrevious }) => useKeyboardNavigation({ onPrevious }), {
          initialProps: { onPrevious: onPrevious as (() => void) | undefined },
        })

        dispatchKeyDown("ArrowLeft")
        expect(onPrevious).toHaveBeenCalledTimes(1)

        // Remove the callback
        rerender({ onPrevious: undefined })

        // Should not throw, just silently do nothing
        expect(() => dispatchKeyDown("ArrowLeft")).not.toThrow()
        expect(onPrevious).toHaveBeenCalledTimes(1) // Still just 1
      })

      it("handles adding callbacks after initial render", () => {
        const onPrevious = vi.fn()
        const onNext = vi.fn()

        // Start with only onPrevious
        const { rerender } = renderHook(
          ({ onPrevious, onNext }) => useKeyboardNavigation({ onPrevious, onNext }),
          { initialProps: { onPrevious, onNext: undefined as (() => void) | undefined } },
        )

        dispatchKeyDown("ArrowRight")
        expect(onNext).not.toHaveBeenCalled() // Not defined yet

        // Add onNext callback
        rerender({ onPrevious, onNext })

        dispatchKeyDown("ArrowRight")
        expect(onNext).toHaveBeenCalledTimes(1)
      })
    })
  })
})
