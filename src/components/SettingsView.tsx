import { useState, useCallback, useEffect, useRef } from "react"
import { useJournal } from "../context/JournalContext"
import { useGoogleCalendar } from "../hooks/useGoogleCalendar"
import { useTheme } from "../hooks/useTheme"
import {
  BackIcon,
  CheckIcon,
  ErrorIcon,
  GoogleIcon,
  MoonIcon,
  MonitorIcon,
  SunIcon,
  WarningIcon,
} from "./Icons"
import type { LLMProviderType } from "../types/journal"
import {
  AUTOSAVE_DEBOUNCE_DELAY,
  SETTINGS_SAVE_STATUS_DURATION,
  SETTINGS_INITIAL_LOAD_DELAY,
} from "@/lib/timing"

// Environment variable defaults for API keys
const ENV_CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY ?? ""
// TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
// const ENV_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ""

/**
 * Validates a Claude API key format.
 * Anthropic API keys should start with 'sk-ant-' and have a reasonable length.
 * @returns null if valid, or an error message if invalid
 */
export function validateClaudeApiKey(key: string): string | null {
  const trimmed = key.trim()
  if (!trimmed) return null // Empty is allowed (no key configured)
  if (!trimmed.startsWith("sk-ant-")) {
    return "Claude API key should start with 'sk-ant-'"
  }
  if (trimmed.length < 20) {
    return "Claude API key appears to be too short"
  }
  return null
}

/**
 * Validates an OpenAI API key format.
 * OpenAI API keys should start with 'sk-' (but not 'sk-ant-') and have a reasonable length.
 * @returns null if valid, or an error message if invalid
 */
export function validateOpenaiApiKey(key: string): string | null {
  const trimmed = key.trim()
  if (!trimmed) return null // Empty is allowed (no key configured)
  if (!trimmed.startsWith("sk-")) {
    return "OpenAI API key should start with 'sk-'"
  }
  if (trimmed.startsWith("sk-ant-")) {
    return "This appears to be a Claude API key, not an OpenAI key"
  }
  if (trimmed.length < 20) {
    return "OpenAI API key appears to be too short"
  }
  return null
}

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
  // Note: llmProvider state is kept but provider selection UI is hidden until OpenAI is wired up (j-3q0)
  const [llmProvider, setLlmProvider] = useState<LLMProviderType>("claude")
  const [claudeApiKey, setClaudeApiKey] = useState("")
  // TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
  // const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [bio, setBio] = useState("")
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  // Autosave status tracking for each field
  const [bioSaveStatus, setBioSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [instructionsSaveStatus, setInstructionsSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  )
  const [claudeApiKeySaveStatus, setClaudeApiKeySaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  )
  const [claudeApiKeyError, setClaudeApiKeyError] = useState<string | null>(null)
  // TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
  // const [openaiApiKeyError, setOpenaiApiKeyError] = useState<string | null>(null)
  const { authState, authenticate, signOut, error: googleError, clearError } = useGoogleCalendar()
  const { preference: themePreference, setTheme } = useTheme()

  // Refs for debounce timeouts
  const bioDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instructionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const claudeApiKeyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bioSaveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instructionsSaveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const claudeApiKeySaveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track if this is the initial load to avoid autosave on mount
  const isInitialLoadRef = useRef(true)

  // Sync local state with document on mount
  // Priority: saved value > env var default
  useEffect(() => {
    if (doc?.settings) {
      if (doc.settings.llmProvider) {
        setLlmProvider(doc.settings.llmProvider)
      }
      // Use saved value if present, otherwise fall back to env var
      setClaudeApiKey(doc.settings.claudeApiKey || ENV_CLAUDE_API_KEY)
      // TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
      // setOpenaiApiKey(doc.settings.openaiApiKey || ENV_OPENAI_API_KEY)
      setBio(doc.settings.bio || "")
      setAdditionalInstructions(doc.settings.additionalInstructions || "")
      // Mark initial load as complete after a short delay to allow state to settle
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, SETTINGS_INITIAL_LOAD_DELAY)
    }
  }, [
    doc?.settings?.llmProvider,
    doc?.settings?.claudeApiKey,
    doc?.settings?.openaiApiKey,
    doc?.settings?.bio,
    doc?.settings?.additionalInstructions,
  ])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (bioDebounceRef.current) clearTimeout(bioDebounceRef.current)
      if (instructionsDebounceRef.current) clearTimeout(instructionsDebounceRef.current)
      if (claudeApiKeyDebounceRef.current) clearTimeout(claudeApiKeyDebounceRef.current)
      if (bioSaveStatusTimeoutRef.current) clearTimeout(bioSaveStatusTimeoutRef.current)
      if (instructionsSaveStatusTimeoutRef.current)
        clearTimeout(instructionsSaveStatusTimeoutRef.current)
      if (claudeApiKeySaveStatusTimeoutRef.current)
        clearTimeout(claudeApiKeySaveStatusTimeoutRef.current)
    }
  }, [])

  // Handle LLM provider change
  // TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
  // const handleProviderChange = useCallback(
  //   (newProvider: LLMProviderType) => {
  //     if (!doc) return
  //     setLlmProvider(newProvider)
  //     changeDoc(d => {
  //       d.settings.llmProvider = newProvider
  //     })
  //   },
  //   [doc, changeDoc],
  // )
  // Suppress unused variable warnings for llmProvider and setLlmProvider
  void llmProvider
  void setLlmProvider

  // Autosave bio with debounce
  const autosaveBio = useCallback(
    (value: string) => {
      if (!doc || isInitialLoadRef.current) return

      // Clear any existing debounce timeout
      if (bioDebounceRef.current) {
        clearTimeout(bioDebounceRef.current)
      }

      // Show saving indicator
      setBioSaveStatus("saving")

      // Debounce the actual save
      bioDebounceRef.current = setTimeout(() => {
        changeDoc(d => {
          d.settings.bio = value.trim()
        })

        // Show saved confirmation briefly
        setBioSaveStatus("saved")
        if (bioSaveStatusTimeoutRef.current) {
          clearTimeout(bioSaveStatusTimeoutRef.current)
        }
        bioSaveStatusTimeoutRef.current = setTimeout(
          () => setBioSaveStatus("idle"),
          SETTINGS_SAVE_STATUS_DURATION,
        )
      }, AUTOSAVE_DEBOUNCE_DELAY)
    },
    [doc, changeDoc],
  )

  // Autosave additional instructions with debounce
  const autosaveAdditionalInstructions = useCallback(
    (value: string) => {
      if (!doc || isInitialLoadRef.current) return

      // Clear any existing debounce timeout
      if (instructionsDebounceRef.current) {
        clearTimeout(instructionsDebounceRef.current)
      }

      // Show saving indicator
      setInstructionsSaveStatus("saving")

      // Debounce the actual save
      instructionsDebounceRef.current = setTimeout(() => {
        changeDoc(d => {
          d.settings.additionalInstructions = value.trim()
        })

        // Show saved confirmation briefly
        setInstructionsSaveStatus("saved")
        if (instructionsSaveStatusTimeoutRef.current) {
          clearTimeout(instructionsSaveStatusTimeoutRef.current)
        }
        instructionsSaveStatusTimeoutRef.current = setTimeout(
          () => setInstructionsSaveStatus("idle"),
          SETTINGS_SAVE_STATUS_DURATION,
        )
      }, AUTOSAVE_DEBOUNCE_DELAY)
    },
    [doc, changeDoc],
  )

  // Autosave Claude API key with debounce and validation
  const autosaveClaudeApiKey = useCallback(
    (value: string) => {
      if (!doc || isInitialLoadRef.current) return

      // Clear any existing debounce timeout
      if (claudeApiKeyDebounceRef.current) {
        clearTimeout(claudeApiKeyDebounceRef.current)
      }

      // Clear error when user types
      setClaudeApiKeyError(null)

      // Show saving indicator
      setClaudeApiKeySaveStatus("saving")

      // Debounce the actual save
      claudeApiKeyDebounceRef.current = setTimeout(() => {
        // Validate API key format
        const validationError = validateClaudeApiKey(value)
        if (validationError) {
          setClaudeApiKeyError(validationError)
          setClaudeApiKeySaveStatus("idle")
          return
        }

        changeDoc(d => {
          d.settings.claudeApiKey = value.trim()
        })

        // Show saved confirmation briefly
        setClaudeApiKeySaveStatus("saved")
        if (claudeApiKeySaveStatusTimeoutRef.current) {
          clearTimeout(claudeApiKeySaveStatusTimeoutRef.current)
        }
        claudeApiKeySaveStatusTimeoutRef.current = setTimeout(
          () => setClaudeApiKeySaveStatus("idle"),
          SETTINGS_SAVE_STATUS_DURATION,
        )
      }, AUTOSAVE_DEBOUNCE_DELAY)
    },
    [doc, changeDoc],
  )

  // Clear Claude API key
  const handleClearClaudeApiKey = useCallback(() => {
    if (!doc) return

    // Clear the saved value - local state falls back to env variable if available
    setClaudeApiKey(ENV_CLAUDE_API_KEY)
    setClaudeApiKeyError(null)
    changeDoc(d => {
      d.settings.claudeApiKey = ""
    })
    setClaudeApiKeySaveStatus("idle")
  }, [doc, changeDoc])

  // Clear OpenAI API key
  // TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
  // const handleClearOpenaiApiKey = useCallback(() => {
  //   if (!doc) return
  //
  //   setOpenaiApiKey("")
  //   changeDoc(d => {
  //     d.settings.openaiApiKey = ""
  //   })
  // }, [doc, changeDoc])

  // Handle bio change with autosave
  const handleBioChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setBio(value)
      autosaveBio(value)
    },
    [autosaveBio],
  )

  // Handle additional instructions change with autosave
  const handleAdditionalInstructionsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setAdditionalInstructions(value)
      autosaveAdditionalInstructions(value)
    },
    [autosaveAdditionalInstructions],
  )

  // Handle Claude API key change with autosave
  const handleClaudeApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setClaudeApiKey(value)
      autosaveClaudeApiKey(value)
    },
    [autosaveClaudeApiKey],
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

  // Track if key is from env var (for showing different UI indicator)
  const isClaudeFromEnv = !doc?.settings?.claudeApiKey && !!ENV_CLAUDE_API_KEY
  // TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
  // const isOpenaiFromEnv = !doc?.settings?.openaiApiKey && !!ENV_OPENAI_API_KEY

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

      {/* LLM Provider Selection - Hidden until OpenAI is wired up */}
      {/* TODO: Uncomment when OpenAI functionality is implemented (j-3q0)
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
      */}

      {/* Bio Section */}
      <section className="flex flex-col gap-3">
        <h3 className="text-foreground text-lg font-medium">About You</h3>
        <p className="text-muted-foreground text-sm">
          Tell the AI a bit about yourself. This helps personalize responses to your context.
        </p>

        <div className="flex flex-col gap-2">
          <textarea
            value={bio}
            onChange={handleBioChange}
            placeholder="e.g., I'm a software engineer living in San Francisco. I enjoy hiking and reading science fiction..."
            className="bg-background focus:ring-ring min-h-[100px] w-full rounded-md border p-3 text-base focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label="Bio"
          />

          {bioSaveStatus !== "idle" && (
            <p
              className={`text-sm ${bioSaveStatus === "saving" ? "text-muted-foreground" : "text-green-600 dark:text-green-400"}`}
              data-testid="bio-save-status"
            >
              {bioSaveStatus === "saving" ? "Saving..." : "Saved"}
            </p>
          )}
        </div>
      </section>

      {/* Additional Instructions Section */}
      <section className="flex flex-col gap-3">
        <h3 className="text-foreground text-lg font-medium">Additional Instructions</h3>
        <p className="text-muted-foreground text-sm">
          Customize how the AI responds to you. These instructions will be included in every
          conversation.
        </p>

        <div className="flex flex-col gap-2">
          <textarea
            value={additionalInstructions}
            onChange={handleAdditionalInstructionsChange}
            placeholder="e.g., Always respond in a casual tone. Focus on practical advice. Ask follow-up questions..."
            className="bg-background focus:ring-ring min-h-[100px] w-full rounded-md border p-3 text-base focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label="Additional instructions"
          />

          {instructionsSaveStatus !== "idle" && (
            <p
              className={`text-sm ${instructionsSaveStatus === "saving" ? "text-muted-foreground" : "text-green-600 dark:text-green-400"}`}
              data-testid="instructions-save-status"
            >
              {instructionsSaveStatus === "saving" ? "Saving..." : "Saved"}
            </p>
          )}
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={claudeApiKey}
                onChange={handleClaudeApiKeyChange}
                placeholder="sk-ant-..."
                className={`bg-background focus:ring-ring w-full rounded-md border p-3 text-base focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                  claudeApiKeyError ? "border-destructive" : ""
                }`}
                aria-label="Claude API key"
                aria-invalid={!!claudeApiKeyError}
                aria-describedby={claudeApiKeyError ? "claude-api-key-error" : undefined}
                autoComplete="off"
              />

              {claudeApiKey && (
                <button
                  type="button"
                  onClick={handleClearClaudeApiKey}
                  className="text-muted-foreground hover:text-destructive hover:border-destructive flex-shrink-0 rounded-md border px-4 py-2 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {claudeApiKeyError && (
              <p
                id="claude-api-key-error"
                className="text-destructive flex items-center gap-1 text-sm"
                role="alert"
              >
                <ErrorIcon />
                {claudeApiKeyError}
              </p>
            )}

            {claudeApiKeySaveStatus !== "idle" && !claudeApiKeyError && (
              <p
                className={`text-sm ${claudeApiKeySaveStatus === "saving" ? "text-muted-foreground" : "text-green-600 dark:text-green-400"}`}
                data-testid="claude-api-key-save-status"
              >
                {claudeApiKeySaveStatus === "saving" ? "Saving..." : "Saved"}
              </p>
            )}

            {claudeApiKey && claudeApiKeySaveStatus === "idle" && !claudeApiKeyError && (
              <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckIcon />
                {isClaudeFromEnv ?
                  "Claude API key configured (from environment)"
                : "Claude API key configured"}
              </p>
            )}
          </div>
        </section>
      )}

      {/* TODO (j-3q0): OpenAI API Key Section
       * To implement OpenAI support, add:
       * - openaiApiKey state and autosave logic (similar to claudeApiKey)
       * - openaiApiKeyError validation state
       * - OpenAI provider option in the LLM Provider Selection section above
       */}

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
