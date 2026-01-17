import { test, expect } from "@playwright/test"

test.describe("Entry editing", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a specific date to ensure consistent state
    await page.goto("/#/day/2025-03-15")
    // Wait for the page to load
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })

  test("creates a new journal entry", async ({ page }) => {
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await expect(textarea).toBeVisible()

    // Type content into the editor
    await textarea.fill("This is my first journal entry for the day.")
    await expect(textarea).toHaveValue("This is my first journal entry for the day.")
  })

  test("shows saving indicator while typing", async ({ page }) => {
    const textarea = page.getByRole("textbox", { name: /journal entry/i })

    // Type something
    await textarea.fill("Testing save indicator")

    // Should show "Saving..." indicator
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toBeVisible()
    await expect(saveIndicator).toHaveText("Saving...")
  })

  test("shows saved indicator after debounce completes", async ({ page }) => {
    const textarea = page.getByRole("textbox", { name: /journal entry/i })

    // Type something
    await textarea.fill("Testing saved indicator")

    // Wait for "Saved" indicator (appears after 500ms debounce)
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toHaveText("Saved", { timeout: 2000 })
  })

  test("editing existing content updates the entry", async ({ page }) => {
    const textarea = page.getByRole("textbox", { name: /journal entry/i })

    // Create initial content
    await textarea.fill("Initial content")

    // Wait for save to complete
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toHaveText("Saved", { timeout: 2000 })

    // Modify the content
    await textarea.fill("Modified content")

    // Wait for new save
    await expect(saveIndicator).toHaveText("Saved", { timeout: 2000 })
    await expect(textarea).toHaveValue("Modified content")
  })
})

test.describe("Entry persistence", () => {
  test("persists content across page navigation", async ({ page }) => {
    const testContent = `Test entry ${Date.now()}`

    // Go to a specific date
    await page.goto("/#/day/2025-04-20")
    await expect(page.getByRole("heading", { level: 1, name: /April 20, 2025/ })).toBeVisible()

    // Add content
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.fill(testContent)

    // Wait for save
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toHaveText("Saved", { timeout: 2000 })

    // Navigate to a different date
    await page.goto("/#/day/2025-04-21")
    await expect(page.getByRole("heading", { level: 1, name: /April 21, 2025/ })).toBeVisible()

    // Navigate back to original date
    await page.goto("/#/day/2025-04-20")
    await expect(page.getByRole("heading", { level: 1, name: /April 20, 2025/ })).toBeVisible()

    // Verify content persisted
    const textareaAfterNav = page.getByRole("textbox", { name: /journal entry/i })
    await expect(textareaAfterNav).toHaveValue(testContent)
  })

  test("persists content across page reload", async ({ page }) => {
    const testContent = `Reload test ${Date.now()}`

    // Go to a specific date
    await page.goto("/#/day/2025-05-10")
    await expect(page.getByRole("heading", { level: 1, name: /May 10, 2025/ })).toBeVisible()

    // Add content
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.fill(testContent)

    // Wait for save
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toHaveText("Saved", { timeout: 2000 })

    // Reload the page
    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: /May 10, 2025/ })).toBeVisible()

    // Verify content persisted after reload
    const textareaAfterReload = page.getByRole("textbox", { name: /journal entry/i })
    await expect(textareaAfterReload).toHaveValue(testContent)
  })

  test("different dates have independent entries", async ({ page }) => {
    const content1 = `Entry for date 1: ${Date.now()}`
    const content2 = `Entry for date 2: ${Date.now()}`

    // Create entry for first date
    await page.goto("/#/day/2025-06-01")
    await expect(page.getByRole("heading", { level: 1, name: /June 1, 2025/ })).toBeVisible()
    const textarea1 = page.getByRole("textbox", { name: /journal entry/i })
    await textarea1.fill(content1)
    await expect(page.getByTestId("save-indicator")).toHaveText("Saved", { timeout: 2000 })

    // Create entry for second date
    await page.goto("/#/day/2025-06-02")
    await expect(page.getByRole("heading", { level: 1, name: /June 2, 2025/ })).toBeVisible()
    const textarea2 = page.getByRole("textbox", { name: /journal entry/i })
    await textarea2.fill(content2)
    await expect(page.getByTestId("save-indicator")).toHaveText("Saved", { timeout: 2000 })

    // Verify first date still has its original content
    await page.goto("/#/day/2025-06-01")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toHaveValue(content1)

    // Verify second date has its content
    await page.goto("/#/day/2025-06-02")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toHaveValue(content2)
  })
})

test.describe("Auto-save behavior", () => {
  test("auto-saves after user stops typing", async ({ page }) => {
    await page.goto("/#/day/2025-07-15")
    await expect(page.getByRole("heading", { level: 1, name: /July 15, 2025/ })).toBeVisible()

    const textarea = page.getByRole("textbox", { name: /journal entry/i })

    // Type content character by character with small delays (simulating real typing)
    await textarea.click()
    await page.keyboard.type("Auto-save test", { delay: 50 })

    // Should show saving while typing
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toBeVisible()

    // Wait for debounce to complete and save to finish
    await expect(saveIndicator).toHaveText("Saved", { timeout: 3000 })
  })

  test("save indicator disappears after a delay", async ({ page }) => {
    await page.goto("/#/day/2025-07-16")
    await expect(page.getByRole("heading", { level: 1, name: /July 16, 2025/ })).toBeVisible()

    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.fill("Testing indicator hide")

    // Wait for "Saved" indicator
    const saveIndicator = page.getByTestId("save-indicator")
    await expect(saveIndicator).toHaveText("Saved", { timeout: 2000 })

    // Wait for indicator to disappear (1500ms after "Saved" appears)
    await expect(saveIndicator).toBeHidden({ timeout: 3000 })
  })
})
