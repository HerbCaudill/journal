/**
 * Crypto utility module for encrypting/decrypting sensitive data in localStorage
 * Uses Web Crypto API with AES-GCM encryption
 */

// Algorithm configuration
const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16

// Storage key for the encryption salt (generated once per browser)
const SALT_STORAGE_KEY = "encryption_salt"

/**
 * Encrypted data format stored in localStorage
 */
export interface EncryptedData {
  /** Base64-encoded initialization vector */
  iv: string
  /** Base64-encoded ciphertext */
  ciphertext: string
  /** Version for future format changes */
  version: 1
}

/**
 * Get or create a persistent salt for key derivation
 * This ensures the same key is derived across sessions
 */
function getOrCreateSalt(): Uint8Array {
  const existingSalt = localStorage.getItem(SALT_STORAGE_KEY)
  if (existingSalt) {
    return base64ToBytes(existingSalt)
  }

  const newSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  localStorage.setItem(SALT_STORAGE_KEY, bytesToBase64(newSalt))
  return newSalt
}

/**
 * Generate a device-specific identifier for key derivation
 * Combines multiple browser fingerprints for uniqueness
 */
function getDeviceIdentifier(): string {
  // Combine multiple relatively stable browser characteristics
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.colorDepth?.toString() ?? "",
    screen.width?.toString() ?? "",
    screen.height?.toString() ?? "",
    // Add origin to make the key site-specific
    typeof window !== "undefined" ? window.location.origin : "",
  ]

  return components.join("|")
}

/**
 * Derive an encryption key from the device identifier
 * Uses PBKDF2 with a persistent salt
 */
export async function deriveEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const deviceId = getDeviceIdentifier()
  const salt = getOrCreateSalt()

  // Import the device identifier as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(deviceId),
    "PBKDF2",
    false,
    ["deriveKey"],
  )

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false, // Not extractable
    ["encrypt", "decrypt"],
  )
}

/**
 * Encrypt plaintext using AES-GCM
 *
 * @param plaintext - The string to encrypt
 * @param key - The encryption key (from deriveEncryptionKey)
 * @returns Encrypted data object
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    encoder.encode(plaintext),
  )

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    version: 1,
  }
}

/**
 * Decrypt ciphertext using AES-GCM
 *
 * @param data - The encrypted data object
 * @param key - The encryption key (from deriveEncryptionKey)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(data: EncryptedData, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder()
  const iv = base64ToBytes(data.iv)
  const ciphertext = base64ToBytes(data.ciphertext)

  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv as BufferSource,
    },
    key,
    ciphertext as BufferSource,
  )

  return decoder.decode(plaintext)
}

/**
 * Check if a string looks like encrypted data (JSON with our format)
 */
export function isEncryptedData(value: string): boolean {
  try {
    const parsed = JSON.parse(value)
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.iv === "string" &&
      typeof parsed.ciphertext === "string" &&
      parsed.version === 1
    )
  } catch {
    return false
  }
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
