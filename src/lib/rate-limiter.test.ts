import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  calculateBackoffDelay,
  sleep,
  withRetry,
  withConcurrencyLimit,
  withConcurrencyAndRetry,
  RateLimitError,
} from "./rate-limiter"

describe("rate-limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("calculateBackoffDelay", () => {
    const baseConfig = {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0,
      maxRetries: 3,
    }

    it("calculates exponential delay without jitter", () => {
      // attempt 0: 1000 * 2^0 = 1000
      expect(calculateBackoffDelay(0, baseConfig)).toBe(1000)

      // attempt 1: 1000 * 2^1 = 2000
      expect(calculateBackoffDelay(1, baseConfig)).toBe(2000)

      // attempt 2: 1000 * 2^2 = 4000
      expect(calculateBackoffDelay(2, baseConfig)).toBe(4000)

      // attempt 3: 1000 * 2^3 = 8000
      expect(calculateBackoffDelay(3, baseConfig)).toBe(8000)
    })

    it("caps delay at maxDelayMs", () => {
      const config = { ...baseConfig, maxDelayMs: 5000 }

      // attempt 3 would be 8000, but capped at 5000
      expect(calculateBackoffDelay(3, config)).toBe(5000)
    })

    it("adds jitter when configured", () => {
      const config = { ...baseConfig, jitterFactor: 0.5 }

      // With jitter, delay should be between base and base + 50%
      vi.spyOn(Math, "random").mockReturnValue(0.5)
      const delay = calculateBackoffDelay(0, config)

      // 1000 + (1000 * 0.5 * 0.5) = 1250
      expect(delay).toBe(1250)
    })

    it("handles different multipliers", () => {
      const config = { ...baseConfig, backoffMultiplier: 3 }

      // attempt 1: 1000 * 3^1 = 3000
      expect(calculateBackoffDelay(1, config)).toBe(3000)
    })
  })

  describe("sleep", () => {
    it("resolves after specified time", async () => {
      const promise = sleep(1000)

      // Advance time
      vi.advanceTimersByTime(1000)

      // Promise should resolve
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe("withRetry", () => {
    it("returns value on immediate success", async () => {
      const fn = vi.fn().mockResolvedValue("success")

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toEqual({
        value: "success",
        success: true,
        attempts: 1,
      })
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("retries on retryable error and succeeds", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("Rate limited", 429))
        .mockResolvedValueOnce("success after retry")

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toEqual({
        value: "success after retry",
        success: true,
        attempts: 2,
      })
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("retries on 5xx errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("Server error", 500))
        .mockResolvedValueOnce("success")

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("retries on network errors", async () => {
      const networkError = new TypeError("Failed to fetch")
      const fn = vi.fn().mockRejectedValueOnce(networkError).mockResolvedValueOnce("success")

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("does not retry on non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Invalid input"))

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe("Invalid input")
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("respects maxRetries limit", async () => {
      const fn = vi.fn().mockRejectedValue(new RateLimitError("Rate limited", 429))

      const resultPromise = withRetry(fn, { maxRetries: 2 })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3) // Initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it("uses Retry-After header when available", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("Rate limited", 429, 5))
        .mockResolvedValueOnce("success")

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      // Verify the retry happened and succeeded
      expect(result.success).toBe(true)
      expect(result.value).toBe("success")
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("caps Retry-After at maxDelayMs", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("Rate limited", 429, 60))
        .mockResolvedValueOnce("success")

      const resultPromise = withRetry(fn, { maxDelayMs: 10000 })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      // Verify the retry happened despite the long Retry-After (would have waited max 10s)
      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("allows custom isRetryable function", async () => {
      const customError = new Error("Custom retryable error")
      const fn = vi.fn().mockRejectedValueOnce(customError).mockResolvedValueOnce("success")

      const resultPromise = withRetry(fn, {
        isRetryable: error => error instanceof Error && error.message.includes("Custom"),
      })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("converts non-Error rejections to Error objects", async () => {
      const fn = vi.fn().mockRejectedValue("string error")

      const resultPromise = withRetry(fn)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe("string error")
    })
  })

  describe("withConcurrencyLimit", () => {
    beforeEach(() => {
      vi.useRealTimers()
    })

    it("executes all tasks and returns results in order", async () => {
      const tasks = [
        vi.fn().mockResolvedValue("result1"),
        vi.fn().mockResolvedValue("result2"),
        vi.fn().mockResolvedValue("result3"),
      ]

      const results = await withConcurrencyLimit(tasks, {
        maxConcurrent: 3,
        delayBetweenRequestsMs: 0,
      })

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ value: "result1", success: true, attempts: 1 })
      expect(results[1]).toEqual({ value: "result2", success: true, attempts: 1 })
      expect(results[2]).toEqual({ value: "result3", success: true, attempts: 1 })
    })

    it("respects maxConcurrent limit", async () => {
      let concurrentCount = 0
      let maxConcurrent = 0

      const createTask = (delay: number, value: string) => async () => {
        concurrentCount++
        maxConcurrent = Math.max(maxConcurrent, concurrentCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        concurrentCount--
        return value
      }

      const tasks = [
        createTask(50, "a"),
        createTask(50, "b"),
        createTask(50, "c"),
        createTask(50, "d"),
        createTask(50, "e"),
      ]

      await withConcurrencyLimit(tasks, { maxConcurrent: 2, delayBetweenRequestsMs: 0 })

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it("handles task failures gracefully", async () => {
      const tasks = [
        vi.fn().mockResolvedValue("success"),
        vi.fn().mockRejectedValue(new Error("failed")),
        vi.fn().mockResolvedValue("success2"),
      ]

      const results = await withConcurrencyLimit(tasks, {
        maxConcurrent: 3,
        delayBetweenRequestsMs: 0,
      })

      expect(results[0].success).toBe(true)
      expect(results[0].value).toBe("success")

      expect(results[1].success).toBe(false)
      expect(results[1].error?.message).toBe("failed")

      expect(results[2].success).toBe(true)
      expect(results[2].value).toBe("success2")
    })

    it("handles empty task array", async () => {
      const results = await withConcurrencyLimit([])

      expect(results).toEqual([])
    })

    it("enforces delay between requests", async () => {
      const startTimes: number[] = []

      const createTask = () => async () => {
        startTimes.push(Date.now())
        return "result"
      }

      const tasks = [createTask(), createTask(), createTask()]

      await withConcurrencyLimit(tasks, {
        maxConcurrent: 3,
        delayBetweenRequestsMs: 50,
      })

      // Check that each subsequent task started at least 50ms after the previous one
      for (let i = 1; i < startTimes.length; i++) {
        const timeDiff = startTimes[i] - startTimes[i - 1]
        expect(timeDiff).toBeGreaterThanOrEqual(45) // Allow small timing variance
      }
    })
  })

  describe("withConcurrencyAndRetry", () => {
    beforeEach(() => {
      vi.useRealTimers()
    })

    it("combines concurrency limiting with retry logic", async () => {
      const tasks = [
        vi.fn().mockResolvedValue("result1"),
        vi
          .fn()
          .mockRejectedValueOnce(new RateLimitError("Rate limited", 429))
          .mockResolvedValueOnce("result2 after retry"),
        vi.fn().mockResolvedValue("result3"),
      ]

      const results = await withConcurrencyAndRetry(
        tasks,
        { maxConcurrent: 2, delayBetweenRequestsMs: 0 },
        { maxRetries: 1, initialDelayMs: 10 },
      )

      expect(results[0].success).toBe(true)
      expect(results[0].value).toBe("result1")

      expect(results[1].success).toBe(true)
      expect(results[1].value).toBe("result2 after retry")

      expect(results[2].success).toBe(true)
      expect(results[2].value).toBe("result3")
    })

    it("handles all tasks failing after retries", async () => {
      const tasks = [
        vi.fn().mockRejectedValue(new RateLimitError("Rate limited", 429)),
        vi.fn().mockRejectedValue(new RateLimitError("Rate limited", 429)),
      ]

      const results = await withConcurrencyAndRetry(
        tasks,
        { maxConcurrent: 2, delayBetweenRequestsMs: 0 },
        { maxRetries: 1, initialDelayMs: 10 },
      )

      expect(results[0].success).toBe(false)
      expect(results[1].success).toBe(false)
    })
  })

  describe("RateLimitError", () => {
    it("creates error with status code", () => {
      const error = new RateLimitError("Too many requests", 429)

      expect(error.message).toBe("Too many requests")
      expect(error.statusCode).toBe(429)
      expect(error.retryAfter).toBeUndefined()
      expect(error.name).toBe("RateLimitError")
    })

    it("creates error with retry-after", () => {
      const error = new RateLimitError("Too many requests", 429, 30)

      expect(error.statusCode).toBe(429)
      expect(error.retryAfter).toBe(30)
    })
  })
})
