import { SettingsIcon } from "./Icons"

/**
 * Footer component displaying the settings link at the bottom of the page.
 */
export function Footer() {
  return (
    <footer className="border-border border-t p-4">
      <div className="mx-auto flex max-w-2xl items-center justify-end">
        <a
          href="#/settings"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          aria-label="Settings"
        >
          <SettingsIcon />
          <span className="text-sm">Settings</span>
        </a>
      </div>
    </footer>
  )
}
