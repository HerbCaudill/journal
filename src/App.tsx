import { useEffect, useState, useCallback } from "react"
import { Header } from "./components/Header"
import { DayView } from "./components/DayView"
import { SettingsView } from "./components/SettingsView"
import { SwipeContainer } from "./components/SwipeContainer"
import { getToday } from "./lib/dates"
import { useGoogleCalendar } from "./hooks/useGoogleCalendar"

type Route = { type: "day"; date: string } | { type: "settings" } | { type: "oauth-callback" }

/**
 * Checks if the current URL is an OAuth callback
 * OAuth callbacks come in on the path (e.g., /oauth/callback?code=...&state=...)
 * because Google OAuth doesn't allow hash fragments in redirect URIs
 */
function isOAuthCallback(): { code: string; state: string } | null {
  const pathname = window.location.pathname
  const searchParams = new URLSearchParams(window.location.search)

  if (pathname === "/oauth/callback") {
    const code = searchParams.get("code")
    const state = searchParams.get("state")

    if (code && state) {
      return { code, state }
    }
  }

  return null
}

/**
 * Parses the current hash to determine the active route
 * @returns The parsed route, defaulting to today's day view
 */
function parseHash(hash: string): Route {
  // Check for OAuth callback first (path-based, not hash-based)
  if (isOAuthCallback()) {
    return { type: "oauth-callback" }
  }

  // Remove leading '#' and '/'
  const path = hash.replace(/^#?\/?/, "")

  // Match /#/day/YYYY-MM-DD
  const dayMatch = path.match(/^day\/(\d{4}-\d{2}-\d{2})$/)
  if (dayMatch) {
    return { type: "day", date: dayMatch[1] }
  }

  // Match /#/settings
  if (path === "settings") {
    return { type: "settings" }
  }

  // Default to today's date
  return { type: "day", date: getToday() }
}

/**
 * Custom hook for hash-based routing
 */
function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  const handleHashChange = useCallback(() => {
    setRoute(parseHash(window.location.hash))
  }, [])

  useEffect(() => {
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [handleHashChange])

  return route
}

/**
 * Component to handle OAuth callback
 * Processes the authorization code and redirects to settings on completion
 */
function OAuthCallbackHandler() {
  const { handleCallback } = useGoogleCalendar()
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processCallback = async () => {
      const oauthParams = isOAuthCallback()
      if (!oauthParams) {
        setStatus("error")
        setError("Invalid OAuth callback - missing parameters")
        return
      }

      const { code, state } = oauthParams
      const success = await handleCallback(code, state)

      if (success) {
        setStatus("success")
        // Clear the URL and redirect to settings to show the connected state
        window.history.replaceState({}, "", "/")
        window.location.hash = "#/settings"
      } else {
        setStatus("error")
        setError("Failed to complete authentication. Please try again.")
      }
    }

    processCallback()
  }, [handleCallback])

  // Redirect after showing success briefly
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        window.location.hash = "#/settings"
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [status])

  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center">
      <div className="p-8 text-center">
        {status === "processing" && (
          <>
            <div className="border-foreground mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2" />
            <p className="text-lg">Completing authentication...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mb-4 text-4xl text-green-500">✓</div>
            <p className="text-lg">Successfully connected to Google Calendar!</p>
            <p className="text-muted-foreground mt-2 text-sm">Redirecting to settings...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mb-4 text-4xl text-red-500">✗</div>
            <p className="text-lg text-red-500">{error}</p>
            <a href="#/settings" className="text-primary mt-4 inline-block text-sm hover:underline">
              Return to settings
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export function App() {
  const route = useHashRoute()

  // Handle OAuth callback route separately (no header needed)
  if (route.type === "oauth-callback") {
    return <OAuthCallbackHandler />
  }

  // Get the current date for the header (always show today when on settings)
  const currentDate = route.type === "day" ? route.date : getToday()

  return (
    <div className="bg-background text-foreground min-h-screen">
      <Header date={currentDate} showNavigation={route.type === "day"} />
      <main>
        {route.type === "day" && (
          <SwipeContainer date={route.date}>
            <DayView date={route.date} />
          </SwipeContainer>
        )}
        {route.type === "settings" && <SettingsView />}
      </main>
    </div>
  )
}
