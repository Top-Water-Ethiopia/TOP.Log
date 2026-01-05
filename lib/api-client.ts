export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export type ApiFetchOptions = RequestInit & {
  parseAs?: "json" | "text" | "none"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object"
}

function extractMessage(body: unknown): string | null {
  if (!isRecord(body)) return null

  const message = body.message
  if (typeof message === "string" && message.trim()) return message

  const error = body.error
  if (typeof error === "string" && error.trim()) return error

  const details = body.details
  if (typeof details === "string" && details.trim()) return details

  return null
}

/**
 * A small fetch wrapper to enforce consistent client-side behavior.
 *
 * Why this exists:
 * - Different endpoints return different shapes (`{ error }`, `{ message }`, etc.).
 * - `fetch()` does not reject on non-2xx responses, which makes silent failures easy.
 * - Centralizing parsing + error normalization keeps UI layers simple and consistent.
 */
export async function apiFetch<T = unknown>(input: RequestInfo | URL, init?: ApiFetchOptions): Promise<T> {
  const { parseAs = "json", ...fetchInit } = init || {}

  const res = await fetch(input, fetchInit)

  const body =
    parseAs === "none"
      ? null
      : parseAs === "text"
        ? await res.text().catch(() => null)
        : await res.json().catch(() => null)

  if (!res.ok) {
    const message = extractMessage(body) || `Request failed (HTTP ${res.status})`
    throw new ApiError(message, res.status, body)
  }

  return body as T
}

/**
 * Extract a user-facing error message.
 *
 * Why this exists:
 * UI code should not need to know whether an error came from `ApiError`, `Error`, or a string.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return fallback
}
