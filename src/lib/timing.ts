/**
 * Shared timing constants used across the application.
 * These values are exported so they can be imported in tests,
 * ensuring tests stay in sync with implementation.
 */

/**
 * Debounce delay for autosave operations (in milliseconds).
 * Applied to text fields like journal entries, bio, and API key inputs.
 */
export const AUTOSAVE_DEBOUNCE_DELAY = 500

/**
 * Duration to display the "Saved" indicator after a successful save (in milliseconds).
 * Used in EntryEditor to show save confirmation.
 */
export const SAVED_INDICATOR_DURATION = 1500

/**
 * Duration to display save status confirmation in Settings view (in milliseconds).
 * Applied to bio, additional instructions, and API key save indicators.
 */
export const SETTINGS_SAVE_STATUS_DURATION = 2000

/**
 * Delay before clearing the initial load flag in Settings (in milliseconds).
 * Prevents autosave from triggering during component hydration.
 */
export const SETTINGS_INITIAL_LOAD_DELAY = 100
