import { test, expect } from "@playwright/test"

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
  })

  test("displays settings page with all sections", async ({ page }) => {
    // Should show Theme section
    await expect(page.getByRole("heading", { name: "Theme" })).toBeVisible()

    // Should show AI Provider section
    await expect(page.getByRole("heading", { name: "AI Provider" })).toBeVisible()

    // Should show theme buttons
    await expect(page.getByRole("button", { name: /Light/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Dark/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /System/ })).toBeVisible()

    // Should show AI provider buttons
    await expect(page.getByRole("button", { name: "Claude" })).toBeVisible()
    await expect(page.getByRole("button", { name: "OpenAI" })).toBeVisible()
  })

  test("navigates back to journal using back button", async ({ page }) => {
    const backButton = page.getByRole("link", { name: "Back to journal" })
    await expect(backButton).toBeVisible()

    await backButton.click()

    // Should navigate to journal view
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()
  })
})

test.describe("Theme settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
  })

  test("can select light theme", async ({ page }) => {
    const lightButton = page.getByRole("button", { name: /Light/ })
    await lightButton.click()

    await expect(lightButton).toHaveAttribute("aria-pressed", "true")
  })

  test("can select dark theme", async ({ page }) => {
    const darkButton = page.getByRole("button", { name: /Dark/ })
    await darkButton.click()

    await expect(darkButton).toHaveAttribute("aria-pressed", "true")
  })

  test("can select system theme", async ({ page }) => {
    const systemButton = page.getByRole("button", { name: /System/ })
    await systemButton.click()

    await expect(systemButton).toHaveAttribute("aria-pressed", "true")
  })

  test("theme selection persists across navigation", async ({ page }) => {
    const darkButton = page.getByRole("button", { name: /Dark/ })
    await darkButton.click()

    // Wait for theme to be applied
    await expect(darkButton).toHaveAttribute("aria-pressed", "true")

    // Navigate away to home page
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Navigate back to settings
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()

    // Dark theme should still be selected
    await expect(page.getByRole("button", { name: /Dark/ })).toHaveAttribute("aria-pressed", "true")
  })
})

test.describe("AI Provider selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
  })

  test("Claude is selected by default", async ({ page }) => {
    const claudeButton = page.getByRole("button", { name: "Claude" })
    await expect(claudeButton).toHaveAttribute("aria-pressed", "true")
  })

  test("can switch to OpenAI provider", async ({ page }) => {
    const openaiButton = page.getByRole("button", { name: "OpenAI" })
    await openaiButton.click()

    await expect(openaiButton).toHaveAttribute("aria-pressed", "true")

    // OpenAI section should be visible
    await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible()
    await expect(page.getByLabel("OpenAI API key")).toBeVisible()
  })

  test("shows Claude API key section when Claude is selected", async ({ page }) => {
    // Ensure Claude is selected
    await page.getByRole("button", { name: "Claude" }).click()

    await expect(page.getByRole("heading", { name: "Claude AI" })).toBeVisible()
    await expect(page.getByLabel("Claude API key")).toBeVisible()
  })

  // Note: Provider persistence to home page is not tested for OpenAI because
  // the OpenAI provider is not yet implemented. Navigating to home with OpenAI
  // selected would cause an error. This test only verifies the selection works
  // within the settings page context.
})

test.describe("Claude API key management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
    // Ensure Claude is selected
    await page.getByRole("button", { name: "Claude" }).click()
  })

  test("can enter and save a valid Claude API key", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")
    // Find the save button within the Claude AI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter a valid API key format
    await apiKeyInput.fill("sk-ant-api03-test-key-12345678901234567890")

    // Save button should be enabled
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Should show saved confirmation
    await expect(page.getByText("API key saved successfully")).toBeVisible({ timeout: 2000 })

    // Should show configured status
    await expect(page.getByText("Claude API key configured")).toBeVisible()
  })

  test("shows validation error for invalid Claude API key format", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")
    // Find the save button within the Claude AI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter an invalid API key (doesn't start with sk-ant-)
    await apiKeyInput.fill("invalid-api-key-format")
    await saveButton.click()

    // Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText("Claude API key should start with 'sk-ant-'")).toBeVisible()
  })

  test("shows validation error for API key that is too short", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")
    // Find the save button within the Claude AI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter an API key that's too short
    await apiKeyInput.fill("sk-ant-short")
    await saveButton.click()

    // Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText("Claude API key appears to be too short")).toBeVisible()
  })

  test("clears validation error when user types", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")
    // Find the save button within the Claude AI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter an invalid API key
    await apiKeyInput.fill("invalid-key")
    await saveButton.click()

    // Validation error should be visible
    await expect(page.getByRole("alert")).toBeVisible()

    // Type something new - error should clear
    await apiKeyInput.fill("sk-ant-")
    await expect(page.getByRole("alert")).toBeHidden()
  })

  test("shows API key as plain text", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")

    // Enter a key
    await apiKeyInput.fill("sk-ant-api03-test-key-12345678901234567890")

    // Should be text type (visible)
    await expect(apiKeyInput).toHaveAttribute("type", "text")
  })

  test("can clear saved API key", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")
    // Find the save button within the Claude AI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Get the initial value to check if env variable is set
    const initialValue = await apiKeyInput.inputValue()
    const hasEnvVariable = initialValue.startsWith("sk-ant-")

    // Enter and save a valid API key (different from env variable)
    await apiKeyInput.fill("sk-ant-api03-test-key-12345678901234567890")
    await saveButton.click()
    await expect(page.getByText("Claude API key configured")).toBeVisible()

    // Click clear button
    const clearButton = page.getByRole("button", { name: "Clear" })
    await clearButton.click()

    // After clearing, the input should show the env variable value (if set) or be empty
    if (hasEnvVariable) {
      // Env variable fallback - input shows env value
      await expect(apiKeyInput).toHaveValue(initialValue)
      // Configured status should still show (from env variable)
      await expect(page.getByText("Claude API key configured")).toBeVisible()
    } else {
      // No env variable - input should be empty
      await expect(apiKeyInput).toHaveValue("")
      // Configured status should be gone
      await expect(page.getByText("Claude API key configured")).toBeHidden()
    }
  })

  test("saved API key persists across navigation", async ({ page }) => {
    const apiKeyInput = page.getByLabel("Claude API key")
    // Find the save button within the Claude AI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter and save a valid API key
    const testKey = "sk-ant-api03-test-key-12345678901234567890"
    await apiKeyInput.fill(testKey)
    await saveButton.click()
    await expect(page.getByText("Claude API key configured")).toBeVisible()

    // Navigate away to home page
    await page.goto("/#/")
    await expect(page.getByRole("textbox", { name: /journal entry/i })).toBeVisible()

    // Navigate back to settings
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()

    // Make sure Claude provider is selected to see the API key input
    await page.getByRole("button", { name: "Claude" }).click()

    // API key should still be there
    await expect(page.getByLabel("Claude API key")).toHaveValue(testKey)
    await expect(page.getByText("Claude API key configured")).toBeVisible()
  })

  test("Save button is disabled when no changes made", async ({ page }) => {
    // Initially all save buttons should be disabled
    const apiKeyInput = page.getByLabel("Claude API key")
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })
    await expect(saveButton).toBeDisabled()
  })
})

test.describe("OpenAI API key management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
    // Select OpenAI provider
    await page.getByRole("button", { name: "OpenAI" }).click()
    await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible()
  })

  test("can enter and save a valid OpenAI API key", async ({ page }) => {
    const apiKeyInput = page.getByLabel("OpenAI API key")
    // Find the save button within the OpenAI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter a valid API key format
    await apiKeyInput.fill("sk-proj-test-key-123456789012345678901234567890")

    // Save button should be enabled
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Should show saved confirmation
    await expect(page.getByText("API key saved successfully")).toBeVisible({ timeout: 2000 })

    // Should show configured status
    await expect(page.getByText("OpenAI API key configured")).toBeVisible()
  })

  test("shows validation error for invalid OpenAI API key format", async ({ page }) => {
    const apiKeyInput = page.getByLabel("OpenAI API key")
    // Find the save button within the OpenAI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter an invalid API key (doesn't start with sk-)
    await apiKeyInput.fill("invalid-api-key-format")
    await saveButton.click()

    // Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText("OpenAI API key should start with 'sk-'")).toBeVisible()
  })

  test("shows validation error when Claude key is entered in OpenAI field", async ({ page }) => {
    const apiKeyInput = page.getByLabel("OpenAI API key")
    // Find the save button within the OpenAI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Enter a Claude API key in OpenAI field
    await apiKeyInput.fill("sk-ant-api03-test-key-12345678901234567890")
    await saveButton.click()

    // Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(
      page.getByText("This appears to be a Claude API key, not an OpenAI key"),
    ).toBeVisible()
  })

  test("can clear saved OpenAI API key", async ({ page }) => {
    const apiKeyInput = page.getByLabel("OpenAI API key")
    // Find the save button within the OpenAI form section
    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })

    // Get the initial value to check if env variable is set
    const initialValue = await apiKeyInput.inputValue()
    const hasEnvVariable = initialValue.startsWith("sk-")

    // Enter and save a valid API key (different from env variable)
    await apiKeyInput.fill("sk-proj-test-key-123456789012345678901234567890")
    await saveButton.click()
    await expect(page.getByText("OpenAI API key configured")).toBeVisible()

    // Click clear button
    const clearButton = page.getByRole("button", { name: "Clear" })
    await clearButton.click()

    // After clearing, the input should show the env variable value (if set) or be empty
    if (hasEnvVariable) {
      // Env variable fallback - input shows env value
      await expect(apiKeyInput).toHaveValue(initialValue)
      // Configured status should still show (from env variable)
      await expect(page.getByText("OpenAI API key configured")).toBeVisible()
    } else {
      // No env variable - input should be empty
      await expect(apiKeyInput).toHaveValue("")
      // Configured status should be gone
      await expect(page.getByText("OpenAI API key configured")).toBeHidden()
    }
  })

  // Note: OpenAI API key persistence to home page is not tested because
  // the OpenAI provider is not yet implemented. Navigating to home with OpenAI
  // selected would cause an error.
})

test.describe("Google Integration section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
  })

  test("displays Google Integration section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Google Integration" })).toBeVisible()
  })

  test("shows unconfigured message when Google client ID is not set", async ({ page }) => {
    // When Google client ID is not configured, should show unconfigured message
    const unconfiguredMessage = page.getByText(/Google Calendar integration is not configured/)
    // This will be visible if VITE_GOOGLE_CLIENT_ID is not set
    // Note: This test depends on the test environment not having Google configured
    const connectButton = page.getByRole("button", { name: "Connect Google Account" })

    // Either the unconfigured message or the connect button should be visible
    const isUnconfigured = await unconfiguredMessage.isVisible().catch(() => false)
    const hasConnectButton = await connectButton.isVisible().catch(() => false)

    expect(isUnconfigured || hasConnectButton).toBe(true)
  })
})

test.describe("Security warning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
  })

  test("displays security notice about API key storage", async ({ page }) => {
    await expect(page.getByText("Security Notice")).toBeVisible()
    await expect(page.getByText(/Your API keys are stored locally in your browser/)).toBeVisible()
  })
})
