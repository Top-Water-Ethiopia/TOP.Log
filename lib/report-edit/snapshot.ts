import stringify from "json-stable-stringify"

export { stringify as stableStringify }

export async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  // Node.js (server)

  const { createHash } = require("crypto") as typeof import("crypto")
  return createHash("sha256").update(input).digest("hex")
}

export async function hashSnapshot(snapshot: unknown): Promise<string> {
  const stable = stringify(snapshot)
  if (!stable) {
    throw new Error("Failed to stringify snapshot")
  }
  return sha256Hex(stable)
}
