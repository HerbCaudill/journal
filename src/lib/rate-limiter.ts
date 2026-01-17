/**
 * Rate limiting utilities with exponential backoff support.
 * Provides controlled concurrency and retry logic for API calls.
 */

/**
 * Configuration for exponential backoff retry logic
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in milliseconds between retries (default: 30000) */
  maxDelayMs?: number
  /** Multiplier for delay after each retry (default: 2) */
  backoffMultiplier?: number
  /** Jitter factor (0-1) to add randomness to delays (default: 0.1) */
  jitterFactor?: number
  /** Function to determine if an error is retryable (default: retries on network errors and 429/5xx) */
  isRetryable?: (error: unknown) => boolean
}

/**
 * Configuration for controlled concurrency execution
 */
export interface ConcurrencyConfig {
  /** Maximum number of concurrent requests (default: 3) */
  maxConcurrent?: number
  /** Delay in milliseconds between starting each request (default: 100) */
  delayBetweenRequestsMs?: number
}

/**
 * Result of a rate-limited operation
 */
export interface RateLimitedResult<T> {
  /** The result value if successful */
  value?: T
  /** Error if the operation failed after all retries */
  error?: Error
  /** Whether the operation succeeded */
  success: boolean
  /** Number of retry attempts made */
  attempts: number
}

/**
 * Error class for rate limit errors
 */
export class RateLimitError extends Error {
  public readonly statusCode: number
  public readonly retryAfter?: number

  constructor(message: string, statusCode: number, retryAfter?: number) {
    super(message)
    this.name = "RateLimitError"
    this.statusCode = statusCode
    this.retryAfter = retryAfter
  }
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, "isRetryable">> & {
  isRetryable: (error: unknown) => boolean
} = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  isRetryable: (error: unknown): boolean => {
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true
    }
    // Retry on rate limit errors
    if (error instanceof RateLimitError) {
      return error.statusCode === 429 || error.statusCode >= 500
    }
    // Retry on generic errors that look like network issues
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("econnreset") ||
        message.includes("socket")
      )
    }
    return false
  },
}

/**
 * Default concurrency configuration
 */
const DEFAULT_CONCURRENCY_CONFIG: Required<ConcurrencyConfig> = {
  maxConcurrent: 3,
  delayBetweenRequestsMs: 100,
}

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Required<Omit<RetryConfig, "isRetryable">>,
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * Math.random()

  return Math.round(cappedDelay + jitter)
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute an async function with exponential backoff retry logic
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns Promise with the result or error after all retries exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry(async () => {
 *   const response = await fetch(url)
 *   if (response.status === 429) {
 *     throw new RateLimitError("Rate limited", 429)
 *   }
 *   return response.json()
 * })
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<RateLimitedResult<T>> {
  const mergedConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
    isRetryable: config.isRetryable ?? DEFAULT_RETRY_CONFIG.isRetryable,
  }

  let lastError: Error | undefined
  let attempts = 0

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    attempts = attempt + 1

    try {
      const value = await fn()
      return { value, success: true, attempts }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      if (attempt < mergedConfig.maxRetries && mergedConfig.isRetryable(error)) {
        // Check for Retry-After header in rate limit errors
        let delayMs: number
        if (error instanceof RateLimitError && error.retryAfter) {
          delayMs = Math.min(error.retryAfter * 1000, mergedConfig.maxDelayMs)
        } else {
          delayMs = calculateBackoffDelay(attempt, mergedConfig)
        }

        await sleep(delayMs)
        continue
      }

      // Not retryable or max retries reached
      break
    }
  }

  return { error: lastError, success: false, attempts }
}

/**
 * Execute multiple async functions with controlled concurrency
 *
 * @param tasks - Array of async functions to execute
 * @param config - Concurrency configuration
 * @returns Promise with array of results in the same order as input tasks
 *
 * @example
 * ```ts
 * const results = await withConcurrencyLimit([
 *   () => fetchCalendarEvents(calendar1.id),
 *   () => fetchCalendarEvents(calendar2.id),
 *   () => fetchCalendarEvents(calendar3.id),
 * ], { maxConcurrent: 2 })
 * ```
 */
export async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  config: ConcurrencyConfig = {},
): Promise<RateLimitedResult<T>[]> {
  const mergedConfig = { ...DEFAULT_CONCURRENCY_CONFIG, ...config }
  const results: RateLimitedResult<T>[] = new Array(tasks.length)

  // Track which tasks are running and which are pending
  const pending = tasks.map((task, index) => ({ task, index }))
  const running: Promise<void>[] = []

  async function runTask(task: () => Promise<T>, index: number): Promise<void> {
    try {
      const value = await task()
      results[index] = { value, success: true, attempts: 1 }
    } catch (error) {
      results[index] = {
        error: error instanceof Error ? error : new Error(String(error)),
        success: false,
        attempts: 1,
      }
    }
  }

  let lastStartTime = 0

  while (pending.length > 0 || running.length > 0) {
    // Start new tasks up to the concurrency limit
    while (pending.length > 0 && running.length < mergedConfig.maxConcurrent) {
      const { task, index } = pending.shift()!

      // Enforce delay between starting requests
      const now = Date.now()
      const timeSinceLastStart = now - lastStartTime
      if (timeSinceLastStart < mergedConfig.delayBetweenRequestsMs && lastStartTime > 0) {
        await sleep(mergedConfig.delayBetweenRequestsMs - timeSinceLastStart)
      }
      lastStartTime = Date.now()

      const taskPromise = runTask(task, index)
      const wrappedPromise = taskPromise.then(() => {
        const idx = running.indexOf(wrappedPromise)
        if (idx >= 0) running.splice(idx, 1)
      })
      running.push(wrappedPromise)
    }

    // Wait for at least one task to complete
    if (running.length > 0) {
      await Promise.race(running)
    }
  }

  return results
}

/**
 * Execute multiple async functions with controlled concurrency AND retry logic
 *
 * @param tasks - Array of async functions to execute
 * @param concurrencyConfig - Concurrency configuration
 * @param retryConfig - Retry configuration
 * @returns Promise with array of results in the same order as input tasks
 *
 * @example
 * ```ts
 * const results = await withConcurrencyAndRetry([
 *   () => fetchCalendarEvents(calendar1.id),
 *   () => fetchCalendarEvents(calendar2.id),
 * ], { maxConcurrent: 2 }, { maxRetries: 3 })
 * ```
 */
export async function withConcurrencyAndRetry<T>(
  tasks: Array<() => Promise<T>>,
  concurrencyConfig: ConcurrencyConfig = {},
  retryConfig: RetryConfig = {},
): Promise<RateLimitedResult<T>[]> {
  // Wrap each task with retry logic
  const tasksWithRetry = tasks.map(task => () => withRetry(task, retryConfig))

  // Execute with concurrency limit
  const results = await withConcurrencyLimit(tasksWithRetry, concurrencyConfig)

  // Flatten the nested RateLimitedResult structure
  return results.map(result => {
    if (result.success && result.value) {
      return result.value
    }
    return { error: result.error, success: false, attempts: result.value?.attempts ?? 1 }
  })
}
