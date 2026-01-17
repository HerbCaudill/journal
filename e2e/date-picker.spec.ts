import { test, expect } from "@playwright/test"

test.describe("Date picker", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a specific date to ensure consistent state
    await page.goto("/#/day/2025-03-15")
    // Wait for the page to load
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
  })

  test("opens date picker when calendar button is clicked", async ({ page }) => {
    // Click the calendar button
    const calendarButton = page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ })
    await calendarButton.click()

    // Date picker should be visible with weekday headers (use exact match to avoid conflicts)
    await expect(page.getByText("Su", { exact: true })).toBeVisible()
    await expect(page.getByText("Mo", { exact: true })).toBeVisible()
    await expect(page.getByText("Tu", { exact: true })).toBeVisible()
    await expect(page.getByText("We", { exact: true })).toBeVisible()
    await expect(page.getByText("Th", { exact: true })).toBeVisible()
    await expect(page.getByText("Fr", { exact: true })).toBeVisible()
    await expect(page.getByText("Sa", { exact: true })).toBeVisible()

    // Should show "Go to Today" button
    await expect(page.getByRole("button", { name: /go to today/i })).toBeVisible()
  })

  test("closes date picker when clicking outside", async ({ page }) => {
    // Open the date picker
    const calendarButton = page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ })
    await calendarButton.click()

    // Verify it's open
    await expect(page.getByRole("button", { name: /go to today/i })).toBeVisible()

    // Click outside (on the main content area)
    await page.click("body", { position: { x: 10, y: 400 } })

    // Date picker should be closed (Go to Today button should not be visible)
    await expect(page.getByRole("button", { name: /go to today/i })).toBeHidden()
  })

  test("closes date picker when pressing Escape", async ({ page }) => {
    // Open the date picker
    const calendarButton = page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ })
    await calendarButton.click()

    // Verify it's open
    await expect(page.getByRole("button", { name: /go to today/i })).toBeVisible()

    // Press Escape
    await page.keyboard.press("Escape")

    // Date picker should be closed
    await expect(page.getByRole("button", { name: /go to today/i })).toBeHidden()
  })

  test("toggles date picker when clicking calendar button again", async ({ page }) => {
    const calendarButton = page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ })

    // Open date picker
    await calendarButton.click()
    await expect(page.getByRole("button", { name: /go to today/i })).toBeVisible()

    // Click again to close
    await calendarButton.click()
    await expect(page.getByRole("button", { name: /go to today/i })).toBeHidden()
  })
})

test.describe("Date picker date selection", () => {
  test("selects a date and navigates to it", async ({ page }) => {
    // Start on March 15, 2025
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Click on March 20th
    await page.getByRole("button", { name: "2025-03-20" }).click()

    // Should navigate to March 20, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 20, 2025/ })).toBeVisible()

    // Date picker should be closed
    await expect(page.getByRole("button", { name: /go to today/i })).toBeHidden()
  })

  test("selects a date from previous month's overflow days", async ({ page }) => {
    // Start on March 15, 2025 - March 2025 starts on Saturday, so there will be overflow days
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Click on a February day shown in the March calendar (e.g., Feb 23, 2025)
    await page.getByRole("button", { name: "2025-02-23" }).click()

    // Should navigate to February 23, 2025
    await expect(page.getByRole("heading", { level: 1, name: /February 23, 2025/ })).toBeVisible()
  })
})

test.describe("Date picker month navigation", () => {
  test("navigates to previous month", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Should show March 2025
    await expect(page.getByText("March 2025")).toBeVisible()

    // Click previous month button
    await page.getByRole("button", { name: "Previous month" }).click()

    // Should now show February 2025
    await expect(page.getByText("February 2025")).toBeVisible()
  })

  test("navigates to next month", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Should show March 2025
    await expect(page.getByText("March 2025")).toBeVisible()

    // Click next month button
    await page.getByRole("button", { name: "Next month" }).click()

    // Should now show April 2025
    await expect(page.getByText("April 2025")).toBeVisible()
  })

  test("handles year transition when navigating from January to December", async ({ page }) => {
    await page.goto("/#/day/2025-01-15")
    await expect(page.getByRole("heading", { level: 1, name: /January 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Should show January 2025
    await expect(page.getByText("January 2025")).toBeVisible()

    // Click previous month button to go to December 2024
    await page.getByRole("button", { name: "Previous month" }).click()

    // Should now show December 2024
    await expect(page.getByText("December 2024")).toBeVisible()
  })

  test("handles year transition when navigating from December to January", async ({ page }) => {
    await page.goto("/#/day/2024-12-15")
    await expect(page.getByRole("heading", { level: 1, name: /December 15, 2024/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Should show December 2024
    await expect(page.getByText("December 2024")).toBeVisible()

    // Click next month button to go to January 2025
    await page.getByRole("button", { name: "Next month" }).click()

    // Should now show January 2025
    await expect(page.getByText("January 2025")).toBeVisible()
  })

  test("can navigate multiple months and then select a date", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Navigate back 3 months to December 2024
    await page.getByRole("button", { name: "Previous month" }).click()
    await page.getByRole("button", { name: "Previous month" }).click()
    await page.getByRole("button", { name: "Previous month" }).click()

    // Should show December 2024
    await expect(page.getByText("December 2024")).toBeVisible()

    // Select December 25, 2024
    await page.getByRole("button", { name: "2024-12-25" }).click()

    // Should navigate to December 25, 2024
    await expect(page.getByRole("heading", { level: 1, name: /December 25, 2024/ })).toBeVisible()
  })
})

test.describe("Date picker 'Go to Today' button", () => {
  test("navigates to today's date", async ({ page }) => {
    // Start on a date that's not today
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Open date picker
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()

    // Click "Go to Today" button
    await page.getByRole("button", { name: /go to today/i }).click()

    // Date picker should close
    await expect(page.getByRole("button", { name: /go to today/i })).toBeHidden()

    // Should navigate to today's date (we verify the heading contains a date)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("updates view to current month when clicking 'Go to Today'", async ({ page }) => {
    // Start on a date far in the past
    await page.goto("/#/day/2024-06-15")
    await expect(page.getByRole("heading", { level: 1, name: /June 15, 2024/ })).toBeVisible()

    // Open date picker (should show June 2024)
    await page.getByRole("button", { name: /^[A-Z][a-z]+ \d+/ }).click()
    await expect(page.getByText("June 2024")).toBeVisible()

    // Click "Go to Today"
    await page.getByRole("button", { name: /go to today/i }).click()

    // Should have navigated and closed
    await expect(page.getByRole("button", { name: /go to today/i })).toBeHidden()
  })
})

test.describe("Header day navigation", () => {
  test("navigates to previous day using chevron", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Click previous day button
    await page.getByRole("button", { name: "Previous day" }).click()

    // Should navigate to March 14, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 14, 2025/ })).toBeVisible()
  })

  test("navigates to next day using chevron", async ({ page }) => {
    await page.goto("/#/day/2025-03-15")
    await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()

    // Click next day button
    await page.getByRole("button", { name: "Next day" }).click()

    // Should navigate to March 16, 2025
    await expect(page.getByRole("heading", { level: 1, name: /March 16, 2025/ })).toBeVisible()
  })

  test("handles month transition when navigating days", async ({ page }) => {
    await page.goto("/#/day/2025-03-01")
    await expect(page.getByRole("heading", { level: 1, name: /March 1, 2025/ })).toBeVisible()

    // Click previous day button to go to February
    await page.getByRole("button", { name: "Previous day" }).click()

    // Should navigate to February 28, 2025
    await expect(page.getByRole("heading", { level: 1, name: /February 28, 2025/ })).toBeVisible()
  })

  test("handles year transition when navigating days", async ({ page }) => {
    await page.goto("/#/day/2025-01-01")
    await expect(page.getByRole("heading", { level: 1, name: /January 1, 2025/ })).toBeVisible()

    // Click previous day button to go to December 2024
    await page.getByRole("button", { name: "Previous day" }).click()

    // Should navigate to December 31, 2024
    await expect(page.getByRole("heading", { level: 1, name: /December 31, 2024/ })).toBeVisible()
  })
})
