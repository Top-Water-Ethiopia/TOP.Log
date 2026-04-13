import type { CloudinaryUploadAsset } from "@/lib/cloudinary"

export type FileUploadMode = "single" | "multiple"

export function getFileUploadMode(metadata: unknown): FileUploadMode {
  if (!metadata || typeof metadata !== "object") return "single"
  const mode = (metadata as { file_upload_mode?: unknown }).file_upload_mode
  return mode === "multiple" ? "multiple" : "single"
}

// Default max file size is 25MB
export const DEFAULT_FILE_MAX_SIZE_BYTES = 25 * 1024 * 1024

// Valid file size options for admin UI (in bytes)
export const FILE_SIZE_OPTIONS = [
  { label: "5 MB", value: 5 * 1024 * 1024 },
  { label: "10 MB", value: 10 * 1024 * 1024 },
  { label: "25 MB", value: 25 * 1024 * 1024 },
] as const

export function getFileMaxSizeBytes(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return DEFAULT_FILE_MAX_SIZE_BYTES
  const size = (metadata as { file_max_size_bytes?: unknown }).file_max_size_bytes
  if (typeof size === "number" && size > 0 && size <= 25 * 1024 * 1024) {
    return size
  }
  return DEFAULT_FILE_MAX_SIZE_BYTES
}

export type AttributedCloudinaryAsset = CloudinaryUploadAsset & {
  uploadedByUserId?: string
  uploadedByDisplayName?: string
  uploadedAt?: string
}

// Resilient guard: only requires provider + publicId
// secureUrl can be reconstructed from publicId if missing
export function isAttributedCloudinaryAsset(value: unknown): value is AttributedCloudinaryAsset {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<AttributedCloudinaryAsset>
  return candidate.provider === "cloudinary" && typeof candidate.publicId === "string" && candidate.publicId.length > 0
}

export function isAttributedCloudinaryAssetArray(value: unknown): value is AttributedCloudinaryAsset[] {
  return Array.isArray(value) && value.every((item) => isAttributedCloudinaryAsset(item))
}

// Shared timestamp formatter for consistency across upload types
export function formatUploadTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return isoString
    }
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return isoString
  }
}
