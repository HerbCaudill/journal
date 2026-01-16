import { useEffect, useState, useCallback } from "react"
import { Header } from "./components/Header"
import { DayView } from "./components/DayView"
import { SettingsView } from "./components/SettingsView"
import { JournalProvider } from "./context/JournalContext"
import { getToday } from "./lib/dates"

type Route =
  | { type: "day"; date: string }
  | { type: "settings" }

/**
 * Parses the current hash to determine the active route
 * @returns The parsed route, defaulting to today's day view
 */
function parseHash(hash: string): Route {
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


export function App() {
  const route = useHashRoute()

  // Get the current date for the header (always show today when on settings)
  const currentDate = route.type === "day" ? route.date : getToday()

  return (
    <JournalProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Header date={currentDate} />
        <main>
          {route.type === "day" && <DayView date={route.date} />}
          {route.type === "settings" && <SettingsView />}
        </main>
      </div>
    </JournalProvider>
  )
}
