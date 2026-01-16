import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ErrorBoundary } from "./ErrorBoundary"

// Component that throws an error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message")
  }
  return <div>Normal content</div>
}

describe("ErrorBoundary", () => {
  // Suppress console.error during error boundary tests
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText("Test content")).toBeInTheDocument()
  })

  it("renders error UI when a child component throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText(/An unexpected error occurred. Your journal entries are safe/),
    ).toBeInTheDocument()
  })

  it("shows error details in expandable section", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByText("Error details")).toBeInTheDocument()
    expect(screen.getByText("Test error message")).toBeInTheDocument()
  })

  it("provides a reload button", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    // Just verify the reload button exists and is clickable
    const reloadButton = screen.getByRole("button", { name: /reload page/i })
    expect(reloadButton).toBeInTheDocument()
    // Note: We can't easily mock window.location.reload in jsdom,
    // so we just verify the button exists
  })

  it("provides a go home button that resets state", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    const goHomeButton = screen.getByRole("button", { name: /go to today/i })
    fireEvent.click(goHomeButton)

    expect(window.location.hash).toBe("#/")
  })

  it("logs error to console", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(console.error).toHaveBeenCalledWith(
      "ErrorBoundary caught an error:",
      expect.any(Error),
      expect.any(Object),
    )
  })
})
