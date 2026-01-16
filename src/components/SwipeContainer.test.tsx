import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SwipeContainer } from "./SwipeContainer"

// Helper to create mock touch events for fireEvent
function fireTouchStart(element: HTMLElement, clientX: number, clientY: number) {
  fireEvent.touchStart(element, {
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
  })
}

function fireTouchEnd(element: HTMLElement, clientX: number, clientY: number) {
  fireEvent.touchEnd(element, {
    touches: [],
    changedTouches: [{ clientX, clientY }],
  })
}

describe("SwipeContainer", () => {
  let originalHash: string

  beforeEach(() => {
    originalHash = window.location.hash
  })

  afterEach(() => {
    window.location.hash = originalHash
  })

  it("renders children", () => {
    render(
      <SwipeContainer date="2025-01-16">
        <div data-testid="child">Child Content</div>
      </SwipeContainer>
    )

    expect(screen.getByTestId("child")).toBeInTheDocument()
    expect(screen.getByText("Child Content")).toBeInTheDocument()
  })

  it("navigates to next day on swipe left", () => {
    render(
      <SwipeContainer date="2025-01-16">
        <div data-testid="content">Content</div>
      </SwipeContainer>
    )

    const container = screen.getByTestId("content").parentElement!

    fireTouchStart(container, 200, 100)
    fireTouchEnd(container, 50, 100) // Swipe left by 150px

    expect(window.location.hash).toBe("#/day/2025-01-17")
  })

  it("navigates to previous day on swipe right", () => {
    render(
      <SwipeContainer date="2025-01-16">
        <div data-testid="content">Content</div>
      </SwipeContainer>
    )

    const container = screen.getByTestId("content").parentElement!

    fireTouchStart(container, 50, 100)
    fireTouchEnd(container, 200, 100) // Swipe right by 150px

    expect(window.location.hash).toBe("#/day/2025-01-15")
  })

  it("handles month boundary on swipe left", () => {
    render(
      <SwipeContainer date="2025-01-31">
        <div data-testid="content">Content</div>
      </SwipeContainer>
    )

    const container = screen.getByTestId("content").parentElement!

    fireTouchStart(container, 200, 100)
    fireTouchEnd(container, 50, 100) // Swipe left

    expect(window.location.hash).toBe("#/day/2025-02-01")
  })

  it("handles month boundary on swipe right", () => {
    render(
      <SwipeContainer date="2025-02-01">
        <div data-testid="content">Content</div>
      </SwipeContainer>
    )

    const container = screen.getByTestId("content").parentElement!

    fireTouchStart(container, 50, 100)
    fireTouchEnd(container, 200, 100) // Swipe right

    expect(window.location.hash).toBe("#/day/2025-01-31")
  })

  it("does not navigate when swipe is too short", () => {
    window.location.hash = "#/day/2025-01-16"

    render(
      <SwipeContainer date="2025-01-16">
        <div data-testid="content">Content</div>
      </SwipeContainer>
    )

    const container = screen.getByTestId("content").parentElement!

    fireTouchStart(container, 100, 100)
    fireTouchEnd(container, 80, 100) // Only 20px movement, below threshold

    expect(window.location.hash).toBe("#/day/2025-01-16")
  })

  it("has touch-pan-y class for vertical scrolling", () => {
    render(
      <SwipeContainer date="2025-01-16">
        <div data-testid="content">Content</div>
      </SwipeContainer>
    )

    const container = screen.getByTestId("content").parentElement!
    expect(container).toHaveClass("touch-pan-y")
  })
})
