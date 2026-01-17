import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  deriveEncryptionKey,
  encrypt,
  decrypt,
  isEncryptedData,
  type EncryptedData,
} from "./crypto"

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  }),
}
Object.defineProperty(global, "localStorage", { value: localStorageMock })

describe("crypto", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("deriveEncryptionKey", () => {
    it("generates a valid CryptoKey", async () => {
      const key = await deriveEncryptionKey()

      expect(key).toBeDefined()
      expect(key.type).toBe("secret")
      expect(key.algorithm.name).toBe("AES-GCM")
    })

    it("generates the same key for the same salt", async () => {
      // First call creates and stores a salt
      const key1 = await deriveEncryptionKey()
      // Second call should use the same salt
      const key2 = await deriveEncryptionKey()

      // We can't directly compare keys, but we can verify they produce the same ciphertext
      const testData = "test data"
      const encrypted1 = await encrypt(testData, key1)
      const decrypted = await decrypt(encrypted1, key2)

      expect(decrypted).toBe(testData)
    })

    it("stores the salt in localStorage", async () => {
      await deriveEncryptionKey()

      expect(localStorageMock.setItem).toHaveBeenCalledWith("encryption_salt", expect.any(String))
    })

    it("reuses existing salt from localStorage", async () => {
      // Set up an existing salt
      mockLocalStorage["encryption_salt"] = btoa(
        String.fromCharCode(...new Uint8Array(16).fill(42)),
      )

      await deriveEncryptionKey()

      // Should have called getItem but not setItem for the salt
      expect(localStorageMock.getItem).toHaveBeenCalledWith("encryption_salt")
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        "encryption_salt",
        expect.any(String),
      )
    })
  })

  describe("encrypt and decrypt", () => {
    it("encrypts and decrypts a string successfully", async () => {
      const key = await deriveEncryptionKey()
      const plaintext = "Hello, World!"

      const encrypted = await encrypt(plaintext, key)
      const decrypted = await decrypt(encrypted, key)

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts to a valid EncryptedData format", async () => {
      const key = await deriveEncryptionKey()
      const plaintext = "test"

      const encrypted = await encrypt(plaintext, key)

      expect(encrypted).toHaveProperty("iv")
      expect(encrypted).toHaveProperty("ciphertext")
      expect(encrypted).toHaveProperty("version", 1)
      expect(typeof encrypted.iv).toBe("string")
      expect(typeof encrypted.ciphertext).toBe("string")
    })

    it("produces different ciphertext for different plaintexts", async () => {
      const key = await deriveEncryptionKey()

      const encrypted1 = await encrypt("message 1", key)
      const encrypted2 = await encrypt("message 2", key)

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
    })

    it("produces different IVs for each encryption", async () => {
      const key = await deriveEncryptionKey()
      const plaintext = "same message"

      const encrypted1 = await encrypt(plaintext, key)
      const encrypted2 = await encrypt(plaintext, key)

      // IVs should be different even for the same plaintext
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      // But both should decrypt to the same value
      expect(await decrypt(encrypted1, key)).toBe(plaintext)
      expect(await decrypt(encrypted2, key)).toBe(plaintext)
    })

    it("handles empty string", async () => {
      const key = await deriveEncryptionKey()
      const plaintext = ""

      const encrypted = await encrypt(plaintext, key)
      const decrypted = await decrypt(encrypted, key)

      expect(decrypted).toBe("")
    })

    it("handles unicode characters", async () => {
      const key = await deriveEncryptionKey()
      const plaintext = "Hello 世界! 🎉"

      const encrypted = await encrypt(plaintext, key)
      const decrypted = await decrypt(encrypted, key)

      expect(decrypted).toBe(plaintext)
    })

    it("handles long strings", async () => {
      const key = await deriveEncryptionKey()
      const plaintext = "a".repeat(10000)

      const encrypted = await encrypt(plaintext, key)
      const decrypted = await decrypt(encrypted, key)

      expect(decrypted).toBe(plaintext)
    })

    it("handles JSON data", async () => {
      const key = await deriveEncryptionKey()
      const data = {
        accessToken: "mock-token-123",
        refreshToken: "mock-refresh-456",
        expiresAt: 1704067200000,
        tokenType: "Bearer",
      }
      const plaintext = JSON.stringify(data)

      const encrypted = await encrypt(plaintext, key)
      const decrypted = await decrypt(encrypted, key)

      expect(JSON.parse(decrypted)).toEqual(data)
    })

    it("throws error when decrypting with wrong key", async () => {
      const key1 = await deriveEncryptionKey()

      // Clear localStorage to force a new salt
      localStorageMock.clear()
      const key2 = await deriveEncryptionKey()

      const encrypted = await encrypt("secret", key1)

      await expect(decrypt(encrypted, key2)).rejects.toThrow()
    })

    it("throws error when decrypting tampered ciphertext", async () => {
      const key = await deriveEncryptionKey()
      const encrypted = await encrypt("secret", key)

      // Tamper with the ciphertext
      const tampered: EncryptedData = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -4) + "AAAA",
      }

      await expect(decrypt(tampered, key)).rejects.toThrow()
    })

    it("throws error when decrypting with tampered IV", async () => {
      const key = await deriveEncryptionKey()
      const encrypted = await encrypt("secret", key)

      // Tamper with the IV
      const tampered: EncryptedData = {
        ...encrypted,
        iv: encrypted.iv.slice(0, -2) + "AA",
      }

      await expect(decrypt(tampered, key)).rejects.toThrow()
    })
  })

  describe("isEncryptedData", () => {
    it("returns true for valid encrypted data", () => {
      const data: EncryptedData = {
        iv: "base64iv",
        ciphertext: "base64ciphertext",
        version: 1,
      }

      expect(isEncryptedData(JSON.stringify(data))).toBe(true)
    })

    it("returns false for plain JSON (unencrypted tokens)", () => {
      const tokens = {
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: 123456,
        tokenType: "Bearer",
      }

      expect(isEncryptedData(JSON.stringify(tokens))).toBe(false)
    })

    it("returns false for invalid JSON", () => {
      expect(isEncryptedData("not json")).toBe(false)
    })

    it("returns false for null", () => {
      expect(isEncryptedData("null")).toBe(false)
    })

    it("returns false for empty object", () => {
      expect(isEncryptedData("{}")).toBe(false)
    })

    it("returns false for wrong version", () => {
      const data = {
        iv: "base64iv",
        ciphertext: "base64ciphertext",
        version: 2,
      }

      expect(isEncryptedData(JSON.stringify(data))).toBe(false)
    })

    it("returns false for missing iv", () => {
      const data = {
        ciphertext: "base64ciphertext",
        version: 1,
      }

      expect(isEncryptedData(JSON.stringify(data))).toBe(false)
    })

    it("returns false for missing ciphertext", () => {
      const data = {
        iv: "base64iv",
        version: 1,
      }

      expect(isEncryptedData(JSON.stringify(data))).toBe(false)
    })
  })
})
