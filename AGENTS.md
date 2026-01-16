# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first PWA journal app built with React 19, TypeScript, and Automerge for offline-capable data persistence. One screen per day with planned Claude AI integration.

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

## Architecture

**Data Layer (Automerge)**
- `src/lib/repo.ts` - Lazy-initialized Automerge repo singleton with IndexedDB storage
- `src/context/JournalContext.tsx` - Provides `useJournal()` hook for document access
- `src/types/journal.ts` - Core interfaces: `JournalDoc`, `JournalEntry`, `Message`, `Settings`

**Components**
- `DayView` - Main view displaying date header and entry editor
- `EntryEditor` - Textarea with 500ms debounced auto-save to Automerge

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
