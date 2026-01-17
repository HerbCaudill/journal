import { test, expect } from "@playwright/test"

test.describe("Invalid route handling", () => {
  test("gracefully handles invalid date by showing today's view", async ({ page }) => {
    // Navigate to an invalid date (month 13 doesn't exist)
    await page.goto("/#/day/2025-13-45")

    // Should show the day view (falls back to today's date)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible()

    // Should show the journal entry textbox (indicating we're on the day view)
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // The app shows today's date even though URL has invalid date
    // (This is graceful degradation - no crash or error page)
  })

  test("gracefully handles malformed date by showing today's view", async ({ page }) => {
    // Navigate to a completely malformed date
    await page.goto("/#/day/not-a-date")

    // Should show the day view (falls back to today)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible()
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()
  })

  test("handles unknown routes by showing today's view", async ({ page }) => {
    // Navigate to a completely unknown route
    await page.goto("/#/unknown-route")

    // Should show the day view (falls back to today)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible()
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()
  })
})

test.describe("API key validation errors", () => {
  test.describe("Claude API key validation", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/#/settings")
      await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
      // Ensure Claude is selected
      await page.getByRole("button", { name: "Claude" }).click()
    })

    test("shows error for empty API key when save is clicked", async ({ page }) => {
      const apiKeyInput = page.getByLabel("Claude API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // Clear any existing value and try to save empty
      await apiKeyInput.fill("")

      // Save button should be disabled for empty input
      await expect(saveButton).toBeDisabled()
    })

    test("shows error for API key with wrong prefix", async ({ page }) => {
      const apiKeyInput = page.getByLabel("Claude API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // Enter an API key with wrong prefix
      await apiKeyInput.fill("wrong-prefix-12345678901234567890")
      await saveButton.click()

      // Should show validation error
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(page.getByText(/Claude API key should start with 'sk-ant-'/)).toBeVisible()
    })

    test("error message is accessible with role alert", async ({ page }) => {
      const apiKeyInput = page.getByLabel("Claude API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // Trigger validation error
      await apiKeyInput.fill("bad-key")
      await saveButton.click()

      // Error should be accessible
      const alert = page.getByRole("alert")
      await expect(alert).toBeVisible()
      await expect(alert).toHaveText(/Claude API key should start with 'sk-ant-'/)
    })
  })

  test.describe("OpenAI API key validation", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/#/settings")
      await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
      // Select OpenAI provider
      await page.getByRole("button", { name: "OpenAI" }).click()
      await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible()
    })

    test("shows error when entering Claude key in OpenAI field", async ({ page }) => {
      const apiKeyInput = page.getByLabel("OpenAI API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // Enter a Claude API key in the OpenAI field
      await apiKeyInput.fill("sk-ant-api03-test-key-12345678901234567890")
      await saveButton.click()

      // Should show error about wrong key type
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(
        page.getByText(/This appears to be a Claude API key, not an OpenAI key/),
      ).toBeVisible()
    })

    test("shows error for API key with completely wrong format", async ({ page }) => {
      const apiKeyInput = page.getByLabel("OpenAI API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // Enter an API key that doesn't match any format
      await apiKeyInput.fill("totally-invalid-format")
      await saveButton.click()

      // Should show validation error
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(page.getByText(/OpenAI API key should start with 'sk-'/)).toBeVisible()
    })
  })

  test.describe("Error dismissal and recovery", () => {
    test("validation error clears when user starts typing again", async ({ page }) => {
      await page.goto("/#/settings")
      await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
      await page.getByRole("button", { name: "Claude" }).click()

      const apiKeyInput = page.getByLabel("Claude API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // Trigger validation error
      await apiKeyInput.fill("invalid-key")
      await saveButton.click()
      await expect(page.getByRole("alert")).toBeVisible()

      // Start typing - error should clear
      await apiKeyInput.fill("sk-ant-")
      await expect(page.getByRole("alert")).toBeHidden()
    })

    test("can successfully save after fixing validation error", async ({ page }) => {
      await page.goto("/#/settings")
      await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
      await page.getByRole("button", { name: "Claude" }).click()

      const apiKeyInput = page.getByLabel("Claude API key")
      const saveButton = page.getByRole("button", { name: "Save" })

      // First trigger a validation error
      await apiKeyInput.fill("invalid-key")
      await saveButton.click()
      await expect(page.getByRole("alert")).toBeVisible()

      // Fix the key and save again
      await apiKeyInput.fill("sk-ant-api03-fixed-key-12345678901234567890")
      await saveButton.click()

      // Should show success message
      await expect(page.getByText("API key saved successfully")).toBeVisible({ timeout: 2000 })
      await expect(page.getByText("Claude API key configured")).toBeVisible()
    })
  })
})

// These tests only apply when no API key environment variable is configured.
// When VITE_CLAUDE_API_KEY is set, the app always has a fallback API key even after "clearing".
test.describe("LLM Section - No API key state", () => {
  test("shows prompt to configure API key when not set", async ({ page }) => {
    // Clear any saved API key by going to settings first
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
    await page.getByRole("button", { name: "Claude" }).click()

    // Clear any existing key
    const clearButton = page.getByRole("button", { name: "Clear" })
    if (await clearButton.isVisible()) {
      await clearButton.click()
    }

    // Navigate to journal
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Check if the prompt is visible - if env variable is set, this won't be visible
    const promptText = page.getByText(/To use Claude, please add your API key in/)
    const isNoApiKeyState = await promptText.isVisible().catch(() => false)

    // Skip test if env variable provides fallback API key
    test.skip(!isNoApiKeyState, "Skipping: environment variable provides fallback API key")

    // Should show prompt to configure API key with a link to settings
    await expect(promptText).toBeVisible()

    // The prompt should contain a link to settings
    const settingsLink = page.locator("a[href='#/settings']").filter({ hasText: "Settings" })
    await expect(settingsLink.first()).toBeVisible()
  })

  test("Ask button is disabled when no API key is configured", async ({ page }) => {
    // Clear any saved API key
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
    await page.getByRole("button", { name: "Claude" }).click()

    // Clear any existing key
    const clearButton = page.getByRole("button", { name: "Clear" })
    if (await clearButton.isVisible()) {
      await clearButton.click()
    }

    // Navigate to journal
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Check if we're in the no-API-key state
    const promptText = page.getByText(/To use Claude, please add your API key in/)
    const isNoApiKeyState = await promptText.isVisible().catch(() => false)

    // Skip test if env variable provides fallback API key
    test.skip(!isNoApiKeyState, "Skipping: environment variable provides fallback API key")

    // The Ask Claude button should be disabled
    const askButton = page.getByRole("button", { name: /Ask Claude/ })
    await expect(askButton).toBeDisabled()
  })

  test("Settings link in API key prompt navigates to settings", async ({ page }) => {
    // Clear any saved API key
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
    await page.getByRole("button", { name: "Claude" }).click()

    // Clear any existing key
    const clearButton = page.getByRole("button", { name: "Clear" })
    if (await clearButton.isVisible()) {
      await clearButton.click()
    }

    // Navigate to journal
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Check if we're in the no-API-key state
    const promptText = page.getByText(/To use Claude, please add your API key in/)
    const isNoApiKeyState = await promptText.isVisible().catch(() => false)

    // Skip test if env variable provides fallback API key
    test.skip(!isNoApiKeyState, "Skipping: environment variable provides fallback API key")

    // Find the settings link in the API key prompt specifically
    // This is the inline link that says "Settings" (not the header settings icon)
    const settingsLink = page.locator("a[href='#/settings']").filter({ hasText: "Settings" })
    await settingsLink.first().click()

    // Should navigate to settings
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
  })
})

test.describe("Empty journal entry submission", () => {
  test.beforeEach(async ({ page }) => {
    // Set up a valid API key first
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
    await page.getByRole("button", { name: "Claude" }).click()

    const apiKeyInput = page.getByLabel("Claude API key")
    await apiKeyInput.fill("sk-ant-api03-test-key-12345678901234567890")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("API key saved successfully")).toBeVisible({ timeout: 2000 })
  })

  test("shows error when trying to submit with empty journal entry", async ({ page }) => {
    // Navigate to journal
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Make sure the entry is empty
    const entryTextbox = page.getByRole("textbox", { name: /journal entry/i })
    await entryTextbox.fill("")

    // Click the Ask Claude button
    const askButton = page.getByRole("button", { name: /Ask Claude/ })
    await expect(askButton).toBeEnabled()
    await askButton.click()

    // Should show error about needing content
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText(/Please write something in your journal first/)).toBeVisible()
  })

  test("error clears when entering content and resubmitting", async ({ page }) => {
    // Navigate to journal
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Make sure the entry is empty
    const entryTextbox = page.getByRole("textbox", { name: /journal entry/i })
    await entryTextbox.fill("")

    // Click the Ask Claude button to trigger error
    const askButton = page.getByRole("button", { name: /Ask Claude/ })
    await askButton.click()
    await expect(page.getByRole("alert")).toBeVisible()

    // Now enter some content
    await entryTextbox.fill("Today I learned about error handling.")

    // Wait for save to complete
    await expect(page.getByText(/Saved/)).toBeVisible()

    // The error should still be visible until we try again
    // (local errors are cleared on submit, not on typing)
    // Let's click the button again - this time it should try the API
    await askButton.click()

    // The validation error should be cleared (it now tries to call the API)
    // Since we have a test key, it will likely fail with API error,
    // but the local validation error about empty content should not appear
    // Wait a moment and check the error is not the "write something" error
    await page.waitForTimeout(500)

    // If there's an error, it should not be the empty content error
    const alert = page.getByRole("alert")
    const isVisible = await alert.isVisible()
    if (isVisible) {
      await expect(alert).not.toHaveText(/Please write something in your journal first/)
    }
  })
})

test.describe("Navigation error recovery", () => {
  test("can recover from invalid route by using navigation", async ({ page }) => {
    // Start at an invalid route
    await page.goto("/#/day/invalid")

    // Should be redirected to today
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Should be able to navigate normally using chevrons
    const prevButton = page.getByRole("button", { name: /previous day/i })
    await prevButton.click()

    // Should navigate successfully
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()
  })

  test("can use date picker after recovering from invalid route", async ({ page }) => {
    // Start at an invalid route
    await page.goto("/#/day/2099-99-99")

    // Should be redirected to today
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Open date picker
    const calendarButton = page.getByRole("button", { name: "Open calendar" })
    await calendarButton.click()

    // Date picker should open
    await expect(page.getByRole("button", { name: /previous month/i })).toBeVisible()

    // Can navigate in date picker
    await page.getByRole("button", { name: /previous month/i }).click()
    await expect(page.getByRole("button", { name: /previous month/i })).toBeVisible()
  })
})
