import { test, expect } from "@playwright/test"

test("displays today's date by default", async ({ page }) => {
  await page.goto("/")

  // Should show the header with today's date
  const header = page.locator("header")
  await expect(header).toBeVisible()

  // Should show today's date in the h1 header
  const dayHeading = page.getByRole("heading", { level: 1 })
  await expect(dayHeading).toBeVisible()
})

test("navigates to settings page", async ({ page }) => {
  await page.goto("/#/settings")

  // Should show the Settings heading
  await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible()
})

test("navigates to specific day", async ({ page }) => {
  await page.goto("/#/day/2025-03-15")

  // Should show the date in the h1 header
  await expect(page.getByRole("heading", { level: 1, name: /March 15, 2025/ })).toBeVisible()
})
