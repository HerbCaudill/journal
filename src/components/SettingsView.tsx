import { useState, useCallback, useEffect } from "react"
import { useJournal } from "../context/JournalContext"
import { useGoogleCalendar } from "../hooks/useGoogleCalendar"

/**
 * Settings view component for managing app configuration.
 * Allows users to:
 * - Enter their Claude API key for AI integration
 * - Connect their Google account for calendar integration
 */
export function SettingsView() {
  const { doc, changeDoc, isLoading } = useJournal()
  const [apiKey, setApiKey] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [showApiKey, setShowApiKey] = useState(false)
  const { authState, authenticate, signOut, error: googleError, clearError } = useGoogleCalendar()

  // Sync local state with document on mount
  useEffect(() => {
    if (doc?.settings?.claudeApiKey) {
      setApiKey(doc.settings.claudeApiKey)
    }
  }, [doc?.settings?.claudeApiKey])

  // Save API key to document
  const handleSaveApiKey = useCallback(() => {
    if (!doc) return

    setSaveStatus("saving")
    changeDoc(d => {
      d.settings.claudeApiKey = apiKey.trim()
    })

    // Show saved confirmation briefly
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus("idle"), 2000)
  }, [doc, changeDoc, apiKey])

  // Clear API key
  const handleClearApiKey = useCallback(() => {
    if (!doc) return

    setApiKey("")
    changeDoc(d => {
      d.settings.claudeApiKey = ""
    })
    setSaveStatus("idle")
  }, [doc, changeDoc])

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleSaveApiKey()
    },
    [handleSaveApiKey],
  )

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <h2 className="text-foreground text-2xl font-semibold">Settings</h2>
        <div className="animate-pulse">
          <div className="bg-muted h-32 rounded-md" />
        </div>
      </div>
    )
  }

  const hasUnsavedChanges = apiKey !== (doc?.settings?.claudeApiKey ?? "")

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <a
          href="#/"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to journal"
        >
          <BackIcon />
        </a>
        <h2 className="text-foreground text-2xl font-semibold">Settings</h2>
      </div>

      {/* Claude API Key Section */}
      <section className="flex flex-col gap-3">
        <h3 className="text-foreground text-lg font-medium">Claude AI</h3>
        <p className="text-muted-foreground text-sm">
          Enter your Anthropic API key to enable Claude AI features. You can get an API key from{" "}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline"
          >
            console.anthropic.com
          </a>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="bg-background focus:ring-ring w-full rounded-md border p-3 pr-12 text-base focus:ring-2 focus:ring-offset-2 focus:outline-none"
              aria-label="Claude API key"
              autoComplete="off"
            />
            {apiKey && (
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1 transition-colors"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ?
                  <EyeOffIcon />
                : <EyeIcon />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!hasUnsavedChanges || saveStatus === "saving"}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveStatus === "saving" ?
                "Saving..."
              : saveStatus === "saved" ?
                "Saved!"
              : "Save"}
            </button>

            {apiKey && (
              <button
                type="button"
                onClick={handleClearApiKey}
                className="text-muted-foreground hover:text-destructive hover:border-destructive rounded-md border px-4 py-2 transition-colors"
              >
                Clear
              </button>
            )}

            {saveStatus === "saved" && (
              <span className="text-sm text-green-600 dark:text-green-400">
                API key saved successfully
              </span>
            )}
          </div>
        </form>

        {apiKey && !hasUnsavedChanges && (
          <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <CheckIcon />
            API key configured
          </p>
        )}

        {/* Security warning */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <WarningIcon className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Security Notice</p>
            <p className="mt-1 opacity-90">
              Your API key is stored locally in your browser. While this app runs entirely on your
              device, API keys could be exposed to malicious browser extensions or XSS attacks.
              Consider using API keys with spending limits.
            </p>
          </div>
        </div>
      </section>

      {/* Google Integration Section */}
      <section className="flex flex-col gap-3">
        <h3 className="text-foreground text-lg font-medium">Google Integration</h3>
        <p className="text-muted-foreground text-sm">
          Connect your Google account to import calendar events and more.
        </p>

        {googleError && (
          <div className="bg-destructive/10 text-destructive flex items-center justify-between gap-2 rounded p-2 text-sm">
            <span>{googleError}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-destructive hover:text-destructive/80 transition-colors"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {authState === "unconfigured" && (
          <p className="text-muted-foreground text-sm italic">
            Google Calendar integration is not configured. Set up VITE_GOOGLE_CLIENT_ID in your
            environment to enable this feature.
          </p>
        )}

        {authState === "unauthenticated" && (
          <button
            type="button"
            onClick={authenticate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors"
            aria-label="Connect Google Account"
          >
            <GoogleIcon />
            Connect Google Account
          </button>
        )}

        {authState === "authenticating" && (
          <button
            type="button"
            disabled
            className="bg-muted text-muted-foreground flex cursor-not-allowed items-center justify-center gap-2 rounded-md border px-4 py-2"
            aria-label="Connecting to Google"
          >
            <GoogleIcon />
            Connecting...
          </button>
        )}

        {authState === "authenticated" && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckIcon />
              Google account connected
            </p>
            <button
              type="button"
              onClick={signOut}
              className="text-muted-foreground hover:text-destructive hover:border-destructive w-fit rounded-md border px-4 py-2 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

// Icon components
function BackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  )
}
