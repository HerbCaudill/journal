import { describe, it, expect, vi, afterEach } from "vitest"
import { formatDate, parseDate, getToday, addDays, isValidDate, isFutureDate } from "./dates"

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

  describe("isFutureDate", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("should return true for dates after today", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0)) // January 16, 2026

      expect(isFutureDate("2026-01-17")).toBe(true)
      expect(isFutureDate("2026-02-01")).toBe(true)
      expect(isFutureDate("2027-01-01")).toBe(true)
    })

    it("should return false for today", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0)) // January 16, 2026

      expect(isFutureDate("2026-01-16")).toBe(false)
    })

    it("should return false for dates before today", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0)) // January 16, 2026

      expect(isFutureDate("2026-01-15")).toBe(false)
      expect(isFutureDate("2025-12-31")).toBe(false)
      expect(isFutureDate("2020-01-01")).toBe(false)
    })
  })

  describe("date boundary conditions", () => {
    describe("Y2K (Year 2000) dates", () => {
      it("should format Y2K dates correctly", () => {
        expect(formatDate(new Date(1999, 11, 31))).toBe("1999-12-31")
        expect(formatDate(new Date(2000, 0, 1))).toBe("2000-01-01")
        expect(formatDate(new Date(2000, 1, 29))).toBe("2000-02-29") // Y2K was a leap year
      })

      it("should parse Y2K dates correctly", () => {
        const dec31_1999 = parseDate("1999-12-31")
        expect(dec31_1999.getFullYear()).toBe(1999)
        expect(dec31_1999.getMonth()).toBe(11)
        expect(dec31_1999.getDate()).toBe(31)

        const jan1_2000 = parseDate("2000-01-01")
        expect(jan1_2000.getFullYear()).toBe(2000)
        expect(jan1_2000.getMonth()).toBe(0)
        expect(jan1_2000.getDate()).toBe(1)
      })

      it("should validate Y2K dates correctly", () => {
        expect(isValidDate("1999-12-31")).toBe(true)
        expect(isValidDate("2000-01-01")).toBe(true)
        expect(isValidDate("2000-02-29")).toBe(true) // Y2K was a leap year
      })

      it("should handle Y2K date arithmetic", () => {
        expect(addDays("1999-12-31", 1)).toBe("2000-01-01")
        expect(addDays("2000-01-01", -1)).toBe("1999-12-31")
        expect(addDays("1999-12-30", 3)).toBe("2000-01-02")
      })
    })

    describe("Y2038 (32-bit timestamp limit) dates", () => {
      // The Y2038 problem affects timestamps after January 19, 2038 03:14:07 UTC
      // JavaScript uses 64-bit floats for Date, so it should handle these correctly

      it("should format Y2038 dates correctly", () => {
        expect(formatDate(new Date(2038, 0, 19))).toBe("2038-01-19")
        expect(formatDate(new Date(2038, 0, 20))).toBe("2038-01-20")
        expect(formatDate(new Date(2038, 11, 31))).toBe("2038-12-31")
      })

      it("should parse Y2038 dates correctly", () => {
        const jan19_2038 = parseDate("2038-01-19")
        expect(jan19_2038.getFullYear()).toBe(2038)
        expect(jan19_2038.getMonth()).toBe(0)
        expect(jan19_2038.getDate()).toBe(19)

        const jan20_2038 = parseDate("2038-01-20")
        expect(jan20_2038.getFullYear()).toBe(2038)
        expect(jan20_2038.getMonth()).toBe(0)
        expect(jan20_2038.getDate()).toBe(20)
      })

      it("should validate Y2038 dates correctly", () => {
        expect(isValidDate("2038-01-19")).toBe(true)
        expect(isValidDate("2038-01-20")).toBe(true)
        expect(isValidDate("2038-12-31")).toBe(true)
      })

      it("should handle Y2038 date arithmetic", () => {
        expect(addDays("2038-01-19", 1)).toBe("2038-01-20")
        expect(addDays("2038-01-20", -1)).toBe("2038-01-19")
      })

      it("should handle dates well beyond Y2038", () => {
        expect(formatDate(new Date(2100, 0, 1))).toBe("2100-01-01")
        expect(isValidDate("2100-01-01")).toBe(true)
        expect(addDays("2099-12-31", 1)).toBe("2100-01-01")
      })
    })

    describe("leap year edge cases", () => {
      it("should validate Feb 29 in leap years", () => {
        // Divisible by 4 = leap year
        expect(isValidDate("2024-02-29")).toBe(true) // 2024 is a leap year
        expect(isValidDate("2028-02-29")).toBe(true)
        expect(isValidDate("2032-02-29")).toBe(true)
      })

      it("should reject Feb 29 in non-leap years", () => {
        expect(isValidDate("2025-02-29")).toBe(false) // 2025 is not a leap year
        expect(isValidDate("2026-02-29")).toBe(false)
        expect(isValidDate("2027-02-29")).toBe(false)
      })

      it("should reject Feb 29 in century years not divisible by 400", () => {
        // Century years are only leap years if divisible by 400
        expect(isValidDate("1900-02-29")).toBe(false) // 1900 not a leap year
        expect(isValidDate("2100-02-29")).toBe(false) // 2100 not a leap year
        expect(isValidDate("2200-02-29")).toBe(false)
        expect(isValidDate("2300-02-29")).toBe(false)
      })

      it("should validate Feb 29 in century years divisible by 400", () => {
        expect(isValidDate("2000-02-29")).toBe(true) // 2000 was a leap year
        expect(isValidDate("2400-02-29")).toBe(true)
      })

      it("should handle leap year day arithmetic across Feb 28/29", () => {
        // In leap years, Feb 28 + 1 = Feb 29
        expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
        expect(addDays("2024-02-29", 1)).toBe("2024-03-01")

        // In non-leap years, Feb 28 + 1 = Mar 1
        expect(addDays("2025-02-28", 1)).toBe("2025-03-01")
        expect(addDays("2025-03-01", -1)).toBe("2025-02-28")
      })

      it("should format leap year dates correctly", () => {
        expect(formatDate(new Date(2024, 1, 29))).toBe("2024-02-29")
        expect(formatDate(new Date(2000, 1, 29))).toBe("2000-02-29")
      })

      it("should parse leap year dates correctly", () => {
        const feb29_2024 = parseDate("2024-02-29")
        expect(feb29_2024.getFullYear()).toBe(2024)
        expect(feb29_2024.getMonth()).toBe(1)
        expect(feb29_2024.getDate()).toBe(29)
      })

      it("should throw when parsing Feb 29 in non-leap year", () => {
        expect(() => parseDate("2025-02-29")).toThrow("Invalid date")
      })
    })
  })
})
