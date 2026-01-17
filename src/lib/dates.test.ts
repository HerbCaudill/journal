import { describe, it, expect, vi, afterEach } from "vitest"
import { formatDate, parseDate, getToday, addDays, isValidDate } from "./dates"

describe("dates", () => {
  describe("formatDate", () => {
    it("should format a date to YYYY-MM-DD", () => {
      const date = new Date(2026, 0, 16) // January 16, 2026
      expect(formatDate(date)).toBe("2026-01-16")
    })

    it("should pad single-digit months and days", () => {
      const date = new Date(2026, 0, 5) // January 5, 2026
      expect(formatDate(date)).toBe("2026-01-05")
    })

    it("should handle December correctly", () => {
      const date = new Date(2026, 11, 31) // December 31, 2026
      expect(formatDate(date)).toBe("2026-12-31")
    })
  })

  describe("parseDate", () => {
    it("should parse a valid ISO date string", () => {
      const date = parseDate("2026-01-16")
      expect(date.getFullYear()).toBe(2026)
      expect(date.getMonth()).toBe(0) // January
      expect(date.getDate()).toBe(16)
    })

    it("should throw on invalid format", () => {
      expect(() => parseDate("01-16-2026")).toThrow("Invalid date format")
      expect(() => parseDate("2026/01/16")).toThrow("Invalid date format")
      expect(() => parseDate("2026-1-16")).toThrow("Invalid date format")
      expect(() => parseDate("not-a-date")).toThrow("Invalid date format")
    })

    it("should throw on invalid date values", () => {
      expect(() => parseDate("2026-13-01")).toThrow("Invalid date")
      expect(() => parseDate("2026-02-30")).toThrow("Invalid date")
    })
  })

  describe("getToday", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("should return today's date in YYYY-MM-DD format", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0))

      expect(getToday()).toBe("2026-01-16")
    })
  })

  describe("isValidDate", () => {
    it("should return true for valid ISO date strings", () => {
      expect(isValidDate("2026-01-16")).toBe(true)
      expect(isValidDate("2025-12-31")).toBe(true)
      expect(isValidDate("2026-02-28")).toBe(true)
    })

    it("should return true for leap year dates", () => {
      expect(isValidDate("2024-02-29")).toBe(true) // 2024 is a leap year
    })

    it("should return false for invalid format", () => {
      expect(isValidDate("01-16-2026")).toBe(false)
      expect(isValidDate("2026/01/16")).toBe(false)
      expect(isValidDate("2026-1-16")).toBe(false)
      expect(isValidDate("not-a-date")).toBe(false)
      expect(isValidDate("")).toBe(false)
    })

    it("should return false for invalid date values", () => {
      expect(isValidDate("2026-13-01")).toBe(false) // Invalid month
      expect(isValidDate("2026-00-01")).toBe(false) // Invalid month
      expect(isValidDate("2026-02-30")).toBe(false) // February 30 doesn't exist
      expect(isValidDate("2025-02-29")).toBe(false) // 2025 is not a leap year
      expect(isValidDate("2026-04-31")).toBe(false) // April has 30 days
    })
  })

  describe("addDays", () => {
    it("should add days to a date", () => {
      expect(addDays("2026-01-16", 1)).toBe("2026-01-17")
      expect(addDays("2026-01-16", 7)).toBe("2026-01-23")
    })

    it("should subtract days when given negative number", () => {
      expect(addDays("2026-01-16", -1)).toBe("2026-01-15")
      expect(addDays("2026-01-16", -7)).toBe("2026-01-09")
    })

    it("should handle month boundaries", () => {
      expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
      expect(addDays("2026-02-01", -1)).toBe("2026-01-31")
    })

    it("should handle year boundaries", () => {
      expect(addDays("2025-12-31", 1)).toBe("2026-01-01")
      expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
    })

    it("should handle adding zero days", () => {
      expect(addDays("2026-01-16", 0)).toBe("2026-01-16")
    })
  })
})
