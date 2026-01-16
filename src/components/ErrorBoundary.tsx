import { Component, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component that catches JavaScript errors in child component tree.
 * Shows a user-friendly error message with recovery options.
 *
 * React error boundaries can only be implemented as class components.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null })
    window.location.hash = "#/"
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="mb-6 text-6xl">
              <AlertTriangleIcon />
            </div>
            <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. Your journal entries are safe - they're stored locally
              on your device.
            </p>
            {this.state.error && (
              <details className="bg-muted mb-6 rounded-lg p-4 text-left">
                <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-500">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={this.handleReload}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 font-medium transition-colors"
              >
                Reload page
              </button>
              <button
                onClick={this.handleGoHome}
                className="border-border text-foreground hover:bg-muted rounded-lg border px-6 py-2 font-medium transition-colors"
              >
                Go to today
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function AlertTriangleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto text-yellow-500"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
