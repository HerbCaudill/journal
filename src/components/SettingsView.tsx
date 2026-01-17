import { useState, useCallback, useEffect } from "react"
import { useJournal } from "../context/JournalContext"
import { useGoogleCalendar } from "../hooks/useGoogleCalendar"
import { useTheme } from "../hooks/useTheme"
import type { LLMProviderType } from "../types/journal"

// Environment variable defaults for API keys
const ENV_CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY ?? ""
const ENV_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ""

/**
 * Settings view component for managing app configuration.
 * Allows users to:
 * - Enter their Claude API key for AI integration
 * - Connect their Google account for calendar integration
 *
 * API keys can be configured via environment variables (VITE_CLAUDE_API_KEY, VITE_OPENAI_API_KEY)
 * which serve as defaults when no key is saved in the document settings.
 */
export function SettingsView() {
  const { doc, changeDoc, isLoading } = useJournal()
  const [llmProvider, setLlmProvider] = useState<LLMProviderType>("claude")
  const [claudeApiKey, setClaudeApiKey] = useState("")
  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [showClaudeApiKey, setShowClaudeApiKey] = useState(false)
  const [showOpenaiApiKey, setShowOpenaiApiKey] = useState(false)
  const { authState, authenticate, signOut, error: googleError, clearError } = useGoogleCalendar()
  const { preference: themePreference, setTheme } = useTheme()

  // Sync local state with document on mount
  // Priority: saved value > env var default
  useEffect(() => {
    if (doc?.settings) {
      if (doc.settings.llmProvider) {
        setLlmProvider(doc.settings.llmProvider)
      }
      // Use saved value if present, otherwise fall back to env var
      setClaudeApiKey(doc.settings.claudeApiKey || ENV_CLAUDE_API_KEY)
      setOpenaiApiKey(doc.settings.openaiApiKey || ENV_OPENAI_API_KEY)
    }
  }, [doc?.settings?.llmProvider, doc?.settings?.claudeApiKey, doc?.settings?.openaiApiKey])

  // Handle LLM provider change
  const handleProviderChange = useCallback(
    (newProvider: LLMProviderType) => {
      if (!doc) return
      setLlmProvider(newProvider)
      changeDoc(d => {
        d.settings.llmProvider = newProvider
      })
    },
    [doc, changeDoc],
  )

  // Save Claude API key to document
  const handleSaveClaudeApiKey = useCallback(() => {
    if (!doc) return

    setSaveStatus("saving")
    changeDoc(d => {
      d.settings.claudeApiKey = claudeApiKey.trim()
    })

    // Show saved confirmation briefly
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus("idle"), 2000)
  }, [doc, changeDoc, claudeApiKey])

  // Save OpenAI API key to document
  const handleSaveOpenaiApiKey = useCallback(() => {
    if (!doc) return

    setSaveStatus("saving")
    changeDoc(d => {
      d.settings.openaiApiKey = openaiApiKey.trim()
    })

    // Show saved confirmation briefly
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus("idle"), 2000)
  }, [doc, changeDoc, openaiApiKey])

  // Clear Claude API key
  const handleClearClaudeApiKey = useCallback(() => {
    if (!doc) return

    setClaudeApiKey("")
    changeDoc(d => {
      d.settings.claudeApiKey = ""
    })
    setSaveStatus("idle")
  }, [doc, changeDoc])

  // Clear OpenAI API key
  const handleClearOpenaiApiKey = useCallback(() => {
    if (!doc) return

    setOpenaiApiKey("")
    changeDoc(d => {
      d.settings.openaiApiKey = ""
    })
    setSaveStatus("idle")
  }, [doc, changeDoc])

  // Handle Claude form submission
  const handleClaudeSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleSaveClaudeApiKey()
    },
    [handleSaveClaudeApiKey],
  )

  // Handle OpenAI form submission
  const handleOpenaiSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleSaveOpenaiApiKey()
    },
    [handleSaveOpenaiApiKey],
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

  // Determine effective saved value (saved or env var default)
  const effectiveClaudeKey = doc?.settings?.claudeApiKey || ENV_CLAUDE_API_KEY
  const effectiveOpenaiKey = doc?.settings?.openaiApiKey || ENV_OPENAI_API_KEY
  const hasClaudeUnsavedChanges = claudeApiKey !== effectiveClaudeKey
  const hasOpenaiUnsavedChanges = openaiApiKey !== effectiveOpenaiKey

  // Track if key is from env var (for showing different UI indicator)
  const isClaudeFromEnv = !doc?.settings?.claudeApiKey && !!ENV_CLAUDE_API_KEY
  const isOpenaiFromEnv = !doc?.settings?.openaiApiKey && !!ENV_OPENAI_API_KEY

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

      {/* Theme Selection */}
      <section className="flex flex-col gap-3">
        <h3 className="text-foreground text-lg font-medium">Theme</h3>
        <p className="text-muted-foreground text-sm">
          Choose your preferred color scheme for the app.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 transition-colors ${
              themePreference === "light" ?
                "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted"
            }`}
            aria-pressed={themePreference === "light"}
          >
            <SunIcon />
            Light
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 transition-colors ${
              themePreference === "dark" ?
                "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted"
            }`}
            aria-pressed={themePreference === "dark"}
          >
            <MoonIcon />
            Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 transition-colors ${
              themePreference === "system" ?
                "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted"
            }`}
            aria-pressed={themePreference === "system"}
          >
            <MonitorIcon />
            System
          </button>
        </div>
      </section>

      {/* LLM Provider Selection */}
      <section className="flex flex-col gap-3">
        <h3 className="text-foreground text-lg font-medium">AI Provider</h3>
        <p className="text-muted-foreground text-sm">
          Select which AI provider to use for journal reflections and assistance.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleProviderChange("claude")}
            className={`rounded-md border px-4 py-2 transition-colors ${
              llmProvider === "claude" ?
                "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted"
            }`}
            aria-pressed={llmProvider === "claude"}
          >
            Claude
          </button>
          <button
            type="button"
            onClick={() => handleProviderChange("openai")}
            className={`rounded-md border px-4 py-2 transition-colors ${
              llmProvider === "openai" ?
                "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted"
            }`}
            aria-pressed={llmProvider === "openai"}
          >
            OpenAI
          </button>
        </div>
      </section>

      {/* Claude API Key Section - only shown when Claude is selected */}
      {llmProvider === "claude" && (
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

          <form onSubmit={handleClaudeSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type={showClaudeApiKey ? "text" : "password"}
                value={claudeApiKey}
                onChange={e => setClaudeApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="bg-background focus:ring-ring w-full rounded-md border p-3 pr-12 text-base focus:ring-2 focus:ring-offset-2 focus:outline-none"
                aria-label="Claude API key"
                autoComplete="off"
              />
              {claudeApiKey && (
                <button
                  type="button"
                  onClick={() => setShowClaudeApiKey(!showClaudeApiKey)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1 transition-colors"
                  aria-label={showClaudeApiKey ? "Hide API key" : "Show API key"}
                >
                  {showClaudeApiKey ?
                    <EyeOffIcon />
                  : <EyeIcon />}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!hasClaudeUnsavedChanges || saveStatus === "saving"}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveStatus === "saving" ?
                  "Saving..."
                : saveStatus === "saved" ?
                  "Saved!"
                : "Save"}
              </button>

              {claudeApiKey && (
                <button
                  type="button"
                  onClick={handleClearClaudeApiKey}
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

          {claudeApiKey && !hasClaudeUnsavedChanges && (
            <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckIcon />
              {isClaudeFromEnv ?
                "Claude API key configured (from environment)"
              : "Claude API key configured"}
            </p>
          )}
        </section>
      )}

      {/* OpenAI API Key Section - only shown when OpenAI is selected */}
      {llmProvider === "openai" && (
        <section className="flex flex-col gap-3">
          <h3 className="text-foreground text-lg font-medium">OpenAI</h3>
          <p className="text-muted-foreground text-sm">
            Enter your OpenAI API key to enable OpenAI features. You can get an API key from{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline"
            >
              platform.openai.com
            </a>
          </p>

          <form onSubmit={handleOpenaiSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type={showOpenaiApiKey ? "text" : "password"}
                value={openaiApiKey}
                onChange={e => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="bg-background focus:ring-ring w-full rounded-md border p-3 pr-12 text-base focus:ring-2 focus:ring-offset-2 focus:outline-none"
                aria-label="OpenAI API key"
                autoComplete="off"
              />
              {openaiApiKey && (
                <button
                  type="button"
                  onClick={() => setShowOpenaiApiKey(!showOpenaiApiKey)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1 transition-colors"
                  aria-label={showOpenaiApiKey ? "Hide API key" : "Show API key"}
                >
                  {showOpenaiApiKey ?
                    <EyeOffIcon />
                  : <EyeIcon />}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!hasOpenaiUnsavedChanges || saveStatus === "saving"}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveStatus === "saving" ?
                  "Saving..."
                : saveStatus === "saved" ?
                  "Saved!"
                : "Save"}
              </button>

              {openaiApiKey && (
                <button
                  type="button"
                  onClick={handleClearOpenaiApiKey}
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

          {openaiApiKey && !hasOpenaiUnsavedChanges && (
            <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckIcon />
              {isOpenaiFromEnv ?
                "OpenAI API key configured (from environment)"
              : "OpenAI API key configured"}
            </p>
          )}
        </section>
      )}

      {/* Security warning */}
      <section className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <WarningIcon className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Security Notice</p>
            <p className="mt-1 opacity-90">
              Your API keys are stored locally in your browser. While this app runs entirely on your
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

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}
