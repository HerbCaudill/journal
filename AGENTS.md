# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first PWA journal app built with React 19, TypeScript, and Automerge for offline-capable data persistence. One screen per day with Claude AI integration for journaling assistance.

## Commands

```bash
pnpm dev              # Start dev server (opens browser)
pnpm build            # Type-check and build for production
pnpm test             # Run unit tests (watch mode)
pnpm test run         # Run unit tests once
pnpm test:pw          # Run Playwright e2e tests
pnpm test:pw:ui       # E2e tests with interactive UI
pnpm test:all         # Full test suite (typecheck + unit + e2e)
pnpm typecheck        # TypeScript type checking only
pnpm format           # Format code with Prettier
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_CLAUDE_API_KEY` - Optional default Claude API key (can also be set in app Settings)
- `VITE_OPENAI_API_KEY` - Optional default OpenAI API key (can also be set in app Settings)
- `VITE_GOOGLE_CLIENT_ID` - Required for Google Calendar integration (OAuth 2.0 Client ID)
- `VITE_GOOGLE_REDIRECT_URI` - Optional, defaults to `${origin}/oauth/callback`

Note: API keys set via environment variables serve as defaults. Users can override them by entering a different key in the app's Settings. Keys saved in Settings take precedence over environment variables.

## Architecture

**Data Layer (Automerge)**

- `src/lib/repo.ts` - Lazy-initialized Automerge repo singleton with IndexedDB storage
- `src/context/JournalContext.tsx` - Provides `useJournal()` hook for document access
- `src/types/journal.ts` - Core interfaces: `JournalDoc`, `JournalEntry`, `Message`, `Settings`

**Components**

- `Header` - App header with navigation arrows on left/right, day/date/calendar centered (including location badge when position is captured). Location badge is clickable to re-capture location. Settings link has moved to Footer.
- `Footer` - App footer with settings link, displayed at the bottom of the page.
- `DatePicker` - Calendar component for selecting dates, shows days with entries marked
- `DayView` - Main view displaying calendar events, entry editor, and LLM section for a specific date
- `App` - Main application component that handles routing, auto-captures location when viewing today's entry (if geolocation is available and not denied), passes location data to Header, and includes Footer on day view (not on settings)
- `CalendarEvents` - Displays Google Calendar events for the current day (shown at top of DayView)
- `EntryEditor` - Textarea with 500ms debounced auto-save to Automerge; displays save indicator ("Saving..." while debouncing, "Saved" briefly after save completes)
- `LLMSection` - Claude chat-style input with submit button inside container (lower right). Displays only assistant responses (not user messages, since the journal entry is already visible). Provider-agnostic (supports Claude and OpenAI). Auto-focuses the follow-up input when a response is received.
- `SwipeContainer` - Wrapper providing swipe and keyboard navigation between days
- `ErrorBoundary` - React error boundary wrapping the app; catches runtime errors and displays a user-friendly error page with recovery options (reload/go home)

**LLM Integration**

- `src/lib/llm/types.ts` - Provider-agnostic interfaces: `LLMProvider`, `LLMConfig`, `LLMResponse`, `ProviderType`
- `src/lib/llm/providers/claude.ts` - Claude provider implementing `LLMProvider` interface with dynamic system prompt builder
- `src/hooks/useLLM.ts` - Provider-agnostic React hook for managing LLM conversation state. Syncs with `initialMessages` prop changes to ensure each day has its own isolated conversation. Accepts bio and additionalInstructions for customizing the system prompt.
- `src/hooks/useClaude.ts` - Legacy hook (deprecated, wraps useLLM with provider="claude") for backward compatibility
- `src/components/LLMSection.tsx` - Provider-agnostic UI component with submit button, follow-up input, and response display
- `src/types/journal.ts` - Settings type includes `llmProvider` field (claude|openai), provider-specific API keys, `bio`, and `additionalInstructions` for system prompt customization
- Settings view allows selecting LLM provider; only shows API key field for the selected provider
- API keys stored in document settings, shown in plain text with security warning
- API key format validation: Claude keys must start with `sk-ant-`, OpenAI keys must start with `sk-` (but not `sk-ant-`); validation functions exported from SettingsView.tsx
- Bio and Additional Instructions: Users can customize the AI system prompt by providing a bio (context about themselves) and additional instructions (behavioral guidelines). These fields are stored in Settings and passed to the LLM provider when making requests.

**Google Calendar Integration**

- `src/lib/google-calendar.ts` - OAuth flow and Calendar API for fetching events
- `src/hooks/useGoogleCalendar.ts` - React hook managing OAuth authentication state and event fetching
- OAuth callback handled at `/oauth/callback` path - the app detects this URL, processes the authorization code, and redirects to settings on completion

**Geolocation**

- `src/hooks/useGeolocation.ts` - React hook for accessing device geolocation with permission management
- `src/hooks/useReverseGeocode.ts` - React hook for converting coordinates to locality names (uses geocoding library)
- `src/lib/geocoding.ts` - Reverse geocoding using OpenStreetMap Nominatim API with 24-hour caching, LRU eviction (max 100 entries), and rate limiting
- `src/components/LocationBadge.tsx` - Displays locality name (e.g., "Tamariu") with coordinates shown on hover; styled to match date text

**Theme**

- `src/hooks/useTheme.ts` - React hook for managing theme state (light/dark/system). Applies the `dark` class to `<html>` based on user preference, handles system preference detection via `prefers-color-scheme` media query
- Theme toggle UI in SettingsView with Light, Dark, and System options
- Theme preference stored in `settings.theme` in the Automerge document
- Dark theme CSS variables defined in `src/index.css` (`.dark` class)

**Utilities**

- `src/lib/dates.ts` - Date utilities using "YYYY-MM-DD" format throughout. Includes `isValidDate()` for validating date strings (used by router to reject invalid dates like "2025-13-45")
- `src/lib/utils.ts` - `cn()` function for Tailwind class merging

## Code Conventions

- Props types defined at end of file, named `{Component}Props`
- Use `cn()` for combining class names, not template literals
- Named exports only (no default exports)
- Test files: `foo.test.ts` or `foo.test.tsx`
- Playwright selectors: prefer accessible roles/labels, fallback to `data-*` attributes

## Testing

- **Unit tests**: Vitest with jsdom, Testing Library
- **E2e tests**: Playwright (Chromium only), auto-starts dev server on port 5173
- Run single test: `pnpm test -- dates` or `pnpm test:pw app.spec.ts`

**E2E test files:**

- `e2e/app.spec.ts` - Basic app navigation tests
- `e2e/date-picker.spec.ts` - Date picker functionality
- `e2e/entry-editing.spec.ts` - Journal entry persistence
- `e2e/error-states.spec.ts` - Error handling (invalid routes, API key validation errors, empty entry submission, error recovery)
- `e2e/navigation.spec.ts` - Keyboard and swipe navigation
- `e2e/settings.spec.ts` - Settings page functionality including theme selection, AI provider selection, API key management (save/load/clear/validation)

---

## Issue Tracking

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
