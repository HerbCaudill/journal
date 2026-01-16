import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSwipeNavigation } from "./useSwipeNavigation"

// Helper to create mock touch events
function createTouchEvent(clientX: number, clientY: number) {
  return {
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
  } as unknown as React.TouchEvent
}

describe("useSwipeNavigation", () => {
  it("returns touch event handlers", () => {
    const { result } = renderHook(() => useSwipeNavigation())

    expect(result.current).toHaveProperty("onTouchStart")
    expect(result.current).toHaveProperty("onTouchMove")
    expect(result.current).toHaveProperty("onTouchEnd")
    expect(typeof result.current.onTouchStart).toBe("function")
    expect(typeof result.current.onTouchMove).toBe("function")
    expect(typeof result.current.onTouchEnd).toBe("function")
  })

  it("calls onSwipeLeft when swiping left beyond threshold", () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeNavigation({ onSwipeLeft }))

    act(() => {
      result.current.onTouchStart(createTouchEvent(200, 100))
      result.current.onTouchEnd(createTouchEvent(100, 100)) // Move left by 100px
    })

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it("calls onSwipeRight when swiping right beyond threshold", () => {
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipeNavigation({ onSwipeRight }))

    act(() => {
      result.current.onTouchStart(createTouchEvent(100, 100))
      result.current.onTouchEnd(createTouchEvent(200, 100)) // Move right by 100px
    })

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
  })

  it("does not call callbacks when swipe is below threshold", () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() =>
      useSwipeNavigation({ onSwipeLeft, onSwipeRight, threshold: 50 })
    )

    act(() => {
      result.current.onTouchStart(createTouchEvent(100, 100))
      result.current.onTouchEnd(createTouchEvent(130, 100)) // Only 30px, below threshold
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it("does not call callbacks when vertical movement is too large", () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() =>
      useSwipeNavigation({ onSwipeLeft, maxVerticalRatio: 0.5 })
    )

    act(() => {
      result.current.onTouchStart(createTouchEvent(200, 100))
      // Move left by 100px but also down by 100px (ratio = 1.0, exceeds 0.5)
      result.current.onTouchEnd(createTouchEvent(100, 200))
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it("allows slight vertical movement during swipe", () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() =>
      useSwipeNavigation({ onSwipeLeft, maxVerticalRatio: 0.5 })
    )

    act(() => {
      result.current.onTouchStart(createTouchEvent(200, 100))
      // Move left by 100px and down by 30px (ratio = 0.3, within 0.5 limit)
      result.current.onTouchEnd(createTouchEvent(100, 130))
    })

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it("uses custom threshold", () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() =>
      useSwipeNavigation({ onSwipeLeft, threshold: 100 })
    )

    // Swipe 80px - should not trigger
    act(() => {
      result.current.onTouchStart(createTouchEvent(200, 100))
      result.current.onTouchEnd(createTouchEvent(120, 100))
    })
    expect(onSwipeLeft).not.toHaveBeenCalled()

    // Swipe 120px - should trigger
    act(() => {
      result.current.onTouchStart(createTouchEvent(200, 100))
      result.current.onTouchEnd(createTouchEvent(80, 100))
    })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it("handles missing callbacks gracefully", () => {
    const { result } = renderHook(() => useSwipeNavigation({}))

    // Should not throw when no callbacks provided
    expect(() => {
      act(() => {
        result.current.onTouchStart(createTouchEvent(200, 100))
        result.current.onTouchEnd(createTouchEvent(100, 100))
      })
    }).not.toThrow()
  })

  it("handles touchEnd without prior touchStart", () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeNavigation({ onSwipeLeft }))

    // Should not throw or call callback
    expect(() => {
      act(() => {
        result.current.onTouchEnd(createTouchEvent(100, 100))
      })
    }).not.toThrow()

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it("resets state after swipe", () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeNavigation({ onSwipeLeft }))

    // First swipe
    act(() => {
      result.current.onTouchStart(createTouchEvent(200, 100))
      result.current.onTouchEnd(createTouchEvent(100, 100))
    })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)

    // Second touchEnd without touchStart should not trigger
    act(() => {
      result.current.onTouchEnd(createTouchEvent(50, 100))
    })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })
})
