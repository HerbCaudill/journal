import { test, expect } from "@playwright/test"

test.describe("Conversation persistence", () => {
  test("persists conversation after page reload", async ({ page }) => {
    const journalEntry = `Test journal entry for persistence ${Date.now()}`
    const TEST_DATE = "2025-09-20"

    // Mock the Claude API to return a predictable response
    await page.route("**/api.anthropic.com/**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "text",
              text: "This is Claude's response that should persist after reload.",
            },
          ],
          model: "claude-sonnet-4-20250514",
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      })
    })

    // Step 1: Set up API key in settings
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()

    const apiKeyInput = page.getByLabel("Claude API key")
    await apiKeyInput.fill("sk-ant-api03-valid-test-key-for-testing-123456789")

    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })
    await saveButton.click()
    await expect(saveButton).toBeDisabled()

    // Step 2: Navigate to day view and create journal entry
    await page.goto(`/#/day/${TEST_DATE}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.fill(journalEntry)

    // Wait for save to complete
    await expect(page.getByTestId("save-indicator")).toHaveText("Saved", { timeout: 5000 })

    // Step 3: Start conversation with Claude
    const askButton = page.getByRole("button", { name: /ask claude/i })
    await expect(askButton).toBeEnabled()
    await askButton.click()

    // Wait for Claude's response to appear
    await expect(page.getByTestId("assistant-response")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("assistant-response")).toContainText(
      "Claude's response that should persist",
    )

    // Wait for Automerge to sync changes to IndexedDB
    // The handleMessagesChange callback should trigger after assistant response appears
    await page.waitForTimeout(2000)

    // Step 4: Reload the page
    await page.reload()

    // Wait for the page to load
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Wait for Automerge to load data from IndexedDB
    await page.waitForTimeout(2000)

    // Step 5: Verify conversation persisted
    // The journal entry should be visible (as plain text since conversation started)
    await expect(page.getByText(journalEntry)).toBeVisible()

    // The assistant response should also persist
    await expect(page.getByTestId("assistant-response")).toBeVisible()
    await expect(page.getByTestId("assistant-response")).toContainText(
      "Claude's response that should persist",
    )

    // The follow-up input should be visible (indicating conversation mode)
    await expect(page.getByRole("textbox", { name: /follow-up message/i })).toBeVisible()
  })

  test("persists follow-up messages after reload", async ({ page }) => {
    const journalEntry = `Follow-up test entry ${Date.now()}`
    const TEST_DATE = "2025-09-21"
    let requestCount = 0

    // Mock the Claude API with different responses for each call
    await page.route("**/api.anthropic.com/**", async route => {
      requestCount++
      const responseText =
        requestCount === 1 ? "First response from Claude." : "Response to your follow-up question."

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `msg_test_${requestCount}`,
          type: "message",
          role: "assistant",
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
          model: "claude-sonnet-4-20250514",
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      })
    })

    // Step 1: Set up API key
    await page.goto("/#/settings")
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()

    const apiKeyInput = page.getByLabel("Claude API key")
    await apiKeyInput.fill("sk-ant-api03-valid-test-key-for-testing-123456789")

    const saveButton = page
      .locator("form")
      .filter({ has: apiKeyInput })
      .getByRole("button", { name: "Save" })
    await saveButton.click()
    await expect(saveButton).toBeDisabled()

    // Step 2: Create journal entry
    await page.goto(`/#/day/${TEST_DATE}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.fill(journalEntry)
    await expect(page.getByTestId("save-indicator")).toHaveText("Saved", { timeout: 5000 })

    // Step 3: Start conversation
    await page.getByRole("button", { name: /ask claude/i }).click()
    await expect(page.getByTestId("assistant-response")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("assistant-response")).toContainText("First response from Claude")

    // Step 4: Send a follow-up message
    const followUpInput = page.getByRole("textbox", { name: /follow-up message/i })
    await followUpInput.fill("This is my follow-up question")
    await page.getByRole("button", { name: /send follow-up/i }).click()

    // Wait for the second response
    await expect(page.getByText("Response to your follow-up question")).toBeVisible({
      timeout: 10000,
    })

    // Verify we have both the follow-up message and response visible
    await expect(page.getByTestId("user-message")).toBeVisible()
    await expect(page.getByTestId("user-message")).toContainText("This is my follow-up question")

    // Wait for Automerge to sync changes to IndexedDB
    await page.waitForTimeout(2000)

    // Step 5: Reload and verify persistence
    await page.reload()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await page.waitForTimeout(2000)

    // The original journal entry should be visible
    await expect(page.getByText(journalEntry)).toBeVisible()

    // Both assistant responses should persist
    await expect(page.getByText("First response from Claude")).toBeVisible()
    await expect(page.getByText("Response to your follow-up question")).toBeVisible()

    // The follow-up user message should also persist
    await expect(page.getByTestId("user-message")).toBeVisible()
    await expect(page.getByTestId("user-message")).toContainText("This is my follow-up question")
  })
})
