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

- `VITE_GOOGLE_CLIENT_ID` - Required for Google Calendar integration (OAuth 2.0 Client ID)
- `VITE_GOOGLE_REDIRECT_URI` - Optional, defaults to `${origin}/oauth/callback`

## Architecture

**Data Layer (Automerge)**

- `src/lib/repo.ts` - Lazy-initialized Automerge repo singleton with IndexedDB storage
- `src/context/JournalContext.tsx` - Provides `useJournal()` hook for document access
- `src/types/journal.ts` - Core interfaces: `JournalDoc`, `JournalEntry`, `Message`, `Settings`

**Components**

- `Header` - App header with day/date on left, back/calendar/forward navigation in center, and settings on right
- `DatePicker` - Calendar component for selecting dates, shows days with entries marked
- `DayView` - Main view displaying calendar events, entry editor, and Claude section for a specific date
- `CalendarEvents` - Displays Google Calendar events for the current day (shown at top of DayView)
- `EntryEditor` - Textarea with 500ms debounced auto-save to Automerge
- `ClaudeSection` - Submit button to ask Claude about journal entry, displays full conversation with user messages (right-aligned) and assistant messages (left-aligned)
- `SwipeContainer` - Wrapper providing swipe and keyboard navigation between days
- `ErrorBoundary` - React error boundary wrapping the app; catches runtime errors and displays a user-friendly error page with recovery options (reload/go home)

**Claude Integration**

- `src/lib/claude.ts` - Low-level Anthropic API wrapper
- `src/hooks/useClaude.ts` - React hook for managing conversation state
- `src/components/ClaudeSection.tsx` - UI component with submit button, follow-up input, and response display
- API key stored in document settings, configured in Settings view
- Settings UI masks API key (password field with show/hide toggle) and displays security warning about client-side storage

**Google Calendar Integration**

- `src/lib/google-calendar.ts` - OAuth flow and Calendar API for fetching events
- `src/hooks/useGoogleCalendar.ts` - React hook managing OAuth authentication state and event fetching
- OAuth callback handled at `/oauth/callback` path - the app detects this URL, processes the authorization code, and redirects to settings on completion

**Geolocation**

- `src/hooks/useGeolocation.ts` - React hook for accessing device geolocation with permission management
- `src/hooks/useReverseGeocode.ts` - React hook for converting coordinates to locality names (uses geocoding library)
- `src/lib/geocoding.ts` - Reverse geocoding using OpenStreetMap Nominatim API with 24-hour caching, LRU eviction (max 100 entries), and rate limiting
- `src/components/LocationBadge.tsx` - Compact badge displaying locality name (e.g., "Tamariu") with coordinates shown on hover

**Utilities**

- `src/lib/dates.ts` - Date utilities using "YYYY-MM-DD" format throughout
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
