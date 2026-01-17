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
})
