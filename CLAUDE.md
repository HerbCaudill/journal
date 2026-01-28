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
- `DayView` - Main view displaying calendar events, entry editor (hidden once conversation starts, but accessible via "Edit entry" button), and LLM section for a specific date. Edit mode allows users to modify their journal entry after an AI conversation has started.
- `App` - Main application component that handles routing, auto-captures location when viewing today's entry (if geolocation is available and not denied), passes location data to Header, and includes Footer on day view (not on settings)
- `CalendarEvents` - Displays Google Calendar events for the current day (shown at top of DayView)
- `EntryEditor` - Textarea with 500ms debounced auto-save to Automerge; displays save indicator ("Saving..." while debouncing, "Saved" briefly after save completes)
- `LLMSection` - Claude chat-style input with submit button inside container (lower right). Displays all conversation messages (both user and assistant) with distinct styling. Provider-agnostic (supports Claude and OpenAI). Auto-focuses the follow-up input when a response is received.
- `SwipeContainer` - Wrapper providing swipe and keyboard navigation between days
- `ErrorBoundary` - React error boundary wrapping the app; catches runtime errors and displays a user-friendly error page with recovery options (reload/go home)

**LLM Integration**

- `src/lib/llm/types.ts` - Provider-agnostic interfaces: `LLMProvider`, `LLMConfig`, `LLMResponse`, `ProviderType`
- `src/lib/llm/providers/claude.ts` - Claude provider implementing `LLMProvider` interface with dynamic system prompt builder. User-provided content (bio, additionalInstructions) is wrapped in XML tags with security instructions to mitigate prompt injection risks.
- `src/hooks/useLLM.ts` - Provider-agnostic React hook for managing LLM conversation state. Syncs with `initialMessages` prop changes to ensure each day has its own isolated conversation. Accepts bio and additionalInstructions for customizing the system prompt.
- `src/hooks/useClaude.ts` - Legacy hook (deprecated, wraps useLLM with provider="claude") for backward compatibility
- `src/components/LLMSection.tsx` - Provider-agnostic UI component with submit button, follow-up input, and response display
- `src/types/journal.ts` - Settings type includes `llmProvider` field (claude|openai), provider-specific API keys, `bio`, and `additionalInstructions` for system prompt customization
- Settings view shows Claude API key configuration. OpenAI provider selection UI is hidden until OpenAI functionality is fully wired up (issue j-3q0).
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

**Important: Mocking Heavy Dependencies in Unit Tests**

The `LLMSection` component imports the Anthropic SDK, which causes jsdom memory issues when running unit tests. Tests that render components importing `LLMSection` (like `App.tsx` or `DayView.tsx`) must mock the `LLMSection` component:

```typescript
vi.mock("./components/LLMSection", () => ({
  LLMSection: () => null,
  SubmitButtonIcon: () => null,
}))
```

Similarly, when testing components that import from `@automerge/*` packages, avoid using `vi.importActual` as it will load the heavy automerge/WASM dependencies. Instead, create simple mock objects.

**E2E test files:**

- `e2e/app.spec.ts` - Basic app navigation tests
- `e2e/date-picker.spec.ts` - Date picker functionality
- `e2e/entry-editing.spec.ts` - Journal entry persistence
- `e2e/error-states.spec.ts` - Error handling (invalid routes, API key validation errors, empty entry submission, error recovery)
- `e2e/navigation.spec.ts` - Keyboard and swipe navigation
- `e2e/settings.spec.ts` - Settings page functionality including theme selection, AI provider selection, API key management (save/load/clear/validation)

---

## Issue tracking

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

```bash
bd ready                              # Find available work
bd create "title"                     # Create issue
bd show <id>                          # View issue details
bd update <id> --status in_progress   # Claim work
bd close <id>                         # Complete work
bd sync                               # Sync with git
```

> **Context Recovery**: Run `bd prime` after compaction, clear, or new session

### Core Rules

- Track strategic work in beads (multi-session, dependencies, discovered work)
- Use `bd create` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer bd—persistence you don't need beats lost context
- Git workflow: daemon auto-syncs beads changes
- Session management: check `bd ready` for available work

### Essential Commands

#### Finding Work

- `bd ready` - Show issues ready to work (no blockers)
- `bd list --status=open` - All open issues
- `bd list --status=in_progress` - Your active work
- `bd show <id>` - Detailed issue view with dependencies

#### Creating & Updating

- `bd create --title="..." --type=task|bug|feature --priority=2` - New issue
  - Priority: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog). NOT "high"/"medium"/"low"
- `bd update <id> --status=in_progress` - Claim work
- `bd update <id> --assignee=username` - Assign to someone
- `bd close <id>` - Mark complete
- `bd close <id1> <id2> ...` - Close multiple issues at once (more efficient)
- `bd close <id> --reason="explanation"` - Close with reason
- **Tip**: When creating multiple issues/tasks/epics, use parallel subagents for efficiency

#### Dependencies & Blocking

- `bd dep add <issue> <depends-on>` - Add dependency (issue depends on depends-on)
- `bd blocked` - Show all blocked issues
- `bd show <id>` - See what's blocking/blocked by this issue

#### Sync & Collaboration

- Daemon handles beads sync automatically (auto-commit + auto-push + auto-pull enabled)
- `bd sync --status` - Check sync status

#### Project Health

- `bd stats` - Project statistics (open/closed/blocked counts)
- `bd doctor` - Check for issues (sync problems, missing hooks)

### Common Workflows

**Starting work:**

```bash
bd ready           # Find available work
bd show <id>       # Review issue details
bd update <id> --status=in_progress  # Claim it
```

**Completing work:**

```bash
bd close <id1> <id2> ...    # Close all completed issues at once
git push                    # Push to remote (beads auto-synced by daemon)
```

**Creating dependent work:**

```bash
# Run bd create commands in parallel (use subagents for many items)
bd create --title="Implement feature X" --type=feature
bd create --title="Write tests for X" --type=task
bd dep add beads-yyy beads-xxx  # Tests depend on Feature (Feature blocks tests)
```

## Commit message format

```bash
${concise summary of changes} (${issue id})
${more detailed summary of changes}
```
