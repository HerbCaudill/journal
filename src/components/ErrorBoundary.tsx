import { Component, type ReactNode } from "react"
import { AlertTriangleIcon } from "./Icons"

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
            <div className="mb-6">
              <AlertTriangleIcon size={64} className="mx-auto text-yellow-500" />
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
