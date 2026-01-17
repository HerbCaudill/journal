import { test, expect } from "@playwright/test"

test.describe("Keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a specific date to ensure consistent state
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })

  test("navigates to previous day with left arrow key", async ({ page }) => {
    // Press left arrow key
    await page.keyboard.press("ArrowLeft")

    // Should navigate to March 14, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 14, 2025/ })).toBeVisible()
  })

  test("navigates to next day with right arrow key", async ({ page }) => {
    // Press right arrow key
    await page.keyboard.press("ArrowRight")

    // Should navigate to March 16, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 16, 2025/ })).toBeVisible()
  })

  test("handles month transition with keyboard navigation", async ({ page }) => {
    await page.goto("/#/day/2025-03-01")
    await expect(page.getByRole("heading", { level: 1, name: /March 1, 2025/ })).toBeVisible()

    // Press left arrow to go to previous day (February)
    await page.keyboard.press("ArrowLeft")

    // Should navigate to February 28, 2025
    await expect(page.getByRole("heading", { level: 1, name: /February 28, 2025/ })).toBeVisible()
  })

  test("handles year transition with keyboard navigation", async ({ page }) => {
    await page.goto("/#/day/2025-01-01")
    await expect(page.getByRole("heading", { level: 1, name: /January 1, 2025/ })).toBeVisible()

    // Press left arrow to go to previous day (December 2024)
    await page.keyboard.press("ArrowLeft")

    // Should navigate to December 31, 2024
    await expect(page.getByRole("heading", { level: 1, name: /December 31, 2024/ })).toBeVisible()
  })

  test("can navigate multiple days with repeated key presses", async ({ page }) => {
    // Navigate 3 days forward (waiting for each navigation to complete)
    await page.keyboard.press("ArrowRight")
    await expect(page.getByRole("heading", { level: 1, name: /March 16, 2025/ })).toBeVisible()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByRole("heading", { level: 1, name: /March 17, 2025/ })).toBeVisible()
    await page.keyboard.press("ArrowRight")

    // Should be on March 18, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 18, 2025/ })).toBeVisible()

    // Navigate back 2 days
    await page.keyboard.press("ArrowLeft")
    await expect(page.getByRole("heading", { level: 1, name: /March 17, 2025/ })).toBeVisible()
    await page.keyboard.press("ArrowLeft")

    // Should be on March 16, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 16, 2025/ })).toBeVisible()
  })

  test("does not navigate when focus is in the text editor", async ({ page }) => {
    // Focus the text editor
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.click()

    // Press left arrow key - should not navigate (cursor should move in textarea)
    await page.keyboard.press("ArrowLeft")

    // Should still be on March 15, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Press right arrow key - should not navigate
    await page.keyboard.press("ArrowRight")

    // Should still be on March 15, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })

  test("navigates after clicking outside the text editor", async ({ page }) => {
    // Focus the text editor
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.click()

    // Click outside to unfocus (on the header area)
    await page.click("header")

    // Now arrow keys should navigate
    await page.keyboard.press("ArrowRight")

    // Should navigate to March 16, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 16, 2025/ })).toBeVisible()
  })

  test("navigates to today when pressing 't' key", async ({ page }) => {
    // We're on March 15, 2025 from beforeEach
    // Press 't' key to go to today
    await page.keyboard.press("t")

    // Should no longer be on March 15, 2025 (navigated to today)
    // We can't check the exact date since "today" changes, but we can verify navigation happened
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeHidden()

    // And the heading should still exist (showing today's date)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("navigates to today when pressing 'T' key (uppercase)", async ({ page }) => {
    // We're on March 15, 2025 from beforeEach
    // Press 'T' key (shift+t) to go to today
    await page.keyboard.press("Shift+t")

    // Should no longer be on March 15, 2025 (navigated to today)
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeHidden()

    // And the heading should still exist (showing today's date)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("does not navigate to today when pressing 't' in text editor", async ({ page }) => {
    // Focus the text editor
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.click()

    // Type 't' - should type into the editor, not navigate
    await page.keyboard.press("t")

    // Should still be on March 15, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // And the 't' should be in the textarea
    await expect(textarea).toHaveValue("t")
  })
})

test.describe("Swipe navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport for swipe tests
    await page.setViewportSize({ width: 390, height: 844 })
    // Navigate to a specific date
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })

  test("navigates to previous day with swipe right", async ({ page }) => {
    // Perform swipe right gesture using dispatchEvent for touch events
    const main = page.locator("main")
    await main.waitFor()

    const box = await main.boundingBox()
    if (!box) throw new Error("Cannot find main element")

    const startX = box.x + 100
    const endX = box.x + 300
    const y = box.y + box.height / 2

    // Dispatch touch events to simulate swipe
    await page.evaluate(
      ({ startX, endX, y }) => {
        const element = document.querySelector("main")!

        // Touch start
        const touchStart = new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: startX,
              clientY: y,
            }),
          ],
        })
        element.dispatchEvent(touchStart)

        // Touch end
        const touchEnd = new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          changedTouches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: endX,
              clientY: y,
            }),
          ],
        })
        element.dispatchEvent(touchEnd)
      },
      { startX, endX, y },
    )

    // Should navigate to March 14, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 14, 2025/ })).toBeVisible()
  })

  test("navigates to next day with swipe left", async ({ page }) => {
    const main = page.locator("main")
    await main.waitFor()

    const box = await main.boundingBox()
    if (!box) throw new Error("Cannot find main element")

    const startX = box.x + 300
    const endX = box.x + 100
    const y = box.y + box.height / 2

    // Dispatch touch events to simulate swipe left
    await page.evaluate(
      ({ startX, endX, y }) => {
        const element = document.querySelector("main")!

        const touchStart = new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: startX,
              clientY: y,
            }),
          ],
        })
        element.dispatchEvent(touchStart)

        const touchEnd = new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          changedTouches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: endX,
              clientY: y,
            }),
          ],
        })
        element.dispatchEvent(touchEnd)
      },
      { startX, endX, y },
    )

    // Should navigate to March 16, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 16, 2025/ })).toBeVisible()
  })

  test("does not navigate with short swipe (below threshold)", async ({ page }) => {
    const main = page.locator("main")
    await main.waitFor()

    const box = await main.boundingBox()
    if (!box) throw new Error("Cannot find main element")

    const startX = box.x + 150
    const endX = box.x + 170 // Only 20px swipe, below 50px threshold
    const y = box.y + box.height / 2

    await page.evaluate(
      ({ startX, endX, y }) => {
        const element = document.querySelector("main")!

        const touchStart = new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: startX,
              clientY: y,
            }),
          ],
        })
        element.dispatchEvent(touchStart)

        const touchEnd = new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          changedTouches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: endX,
              clientY: y,
            }),
          ],
        })
        element.dispatchEvent(touchEnd)
      },
      { startX, endX, y },
    )

    // Should still be on March 15, 2025 (no navigation)
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })

  test("does not navigate with vertical swipe", async ({ page }) => {
    const main = page.locator("main")
    await main.waitFor()

    const box = await main.boundingBox()
    if (!box) throw new Error("Cannot find main element")

    const x = box.x + box.width / 2
    const startY = box.y + 200
    const endY = box.y + 400 // Vertical swipe

    await page.evaluate(
      ({ x, startY, endY }) => {
        const element = document.querySelector("main")!

        const touchStart = new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: x,
              clientY: startY,
            }),
          ],
        })
        element.dispatchEvent(touchStart)

        const touchEnd = new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          changedTouches: [
            new Touch({
              identifier: 0,
              target: element,
              clientX: x,
              clientY: endY,
            }),
          ],
        })
        element.dispatchEvent(touchEnd)
      },
      { x, startY, endY },
    )

    // Should still be on March 15, 2025 (no navigation)
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })
})

test.describe("Touch gestures on mobile viewport", () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test("touch interactions work on mobile", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Click on the previous day button should work
    const prevButton = page.getByRole("button", { name: "Previous day" })
    await prevButton.click()

    // Should navigate to March 14, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 14, 2025/ })).toBeVisible()
  })

  test("date picker opens with tap on mobile", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Click on calendar button
    const calendarButton = page.getByRole("button", { name: "Open calendar" })
    await calendarButton.click()

    // Date picker should be visible
    await expect(page.getByText("March 2025")).toBeVisible()
    await expect(page.getByRole("button", { name: /go to today/i })).toBeVisible()
  })

  test("can select a date with tap on mobile", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    const calendarButton = page.getByRole("button", { name: "Open calendar" })
    await calendarButton.click()

    // Click on March 20
    const day20 = page.getByRole("button", { name: "2025-03-20" })
    await day20.click()

    // Should navigate to March 20, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 20, 2025/ })).toBeVisible()
  })

  test("text editor is focusable on mobile", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Click on the text editor
    const textarea = page.getByRole("textbox", { name: /journal entry/i })
    await textarea.click()

    // Type some text
    await page.keyboard.type("Mobile entry test")

    // Verify the text was entered
    await expect(textarea).toHaveValue("Mobile entry test")
  })
})
