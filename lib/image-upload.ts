import type { CloudinaryUploadAsset } from "@/lib/cloudinary"
import { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_SIZE_BYTES, IMAGE_MAX_FILES } from "@/lib/upload-config"
// Import types/functions for internal use + re-export for consumers
import type { AttributedCloudinaryAsset } from "@/lib/upload-types"
import {
  isAttributedCloudinaryAsset,
  isAttributedCloudinaryAssetArray,
  formatUploadTimestamp,
} from "@/lib/upload-types"

export type ImageUploadMode = "single" | "multiple"

// Re-export constants from upload-config.ts for backward compatibility
export { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_SIZE_BYTES, IMAGE_MAX_FILES }

// Re-export shared types from upload-types.ts for backward compatibility
export type { AttributedCloudinaryAsset } from "@/lib/upload-types"
export {
  isAttributedCloudinaryAsset,
  isAttributedCloudinaryAssetArray,
  formatUploadTimestamp,
} from "@/lib/upload-types"

export function normalizeImageResponseValue(value: unknown): AttributedCloudinaryAsset[] {
  if (isAttributedCloudinaryAssetArray(value)) {
    return value.filter((item) => isAttributedCloudinaryAsset(item))
  }

  if (isAttributedCloudinaryAsset(value)) {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is AttributedCloudinaryAsset => isAttributedCloudinaryAsset(item))
  }

  if (process.env.NODE_ENV !== "production" && value !== null && value !== undefined && value !== "") {
    console.warn("Invalid image response value encountered; falling back to empty array", value)
  }

  return []
}

export function getImageUploadMode(metadata: unknown): ImageUploadMode {
  if (!metadata || typeof metadata !== "object") return "single"

  const mode = (metadata as { image_upload_mode?: unknown }).image_upload_mode
  return mode === "multiple" ? "multiple" : "single"
}

// Default max image size is 10MB (matches hardcoded IMAGE_MAX_SIZE_BYTES)
export const DEFAULT_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024

// Valid image size options for admin UI (in bytes)
export const IMAGE_SIZE_OPTIONS = [
  { label: "5 MB", value: 5 * 1024 * 1024 },
  { label: "10 MB", value: 10 * 1024 * 1024 },
  { label: "25 MB", value: 25 * 1024 * 1024 },
] as const

export function getImageMaxSizeBytes(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return DEFAULT_IMAGE_MAX_SIZE_BYTES
  const size = (metadata as { image_max_size_bytes?: unknown }).image_max_size_bytes
  if (typeof size === "number" && size > 0 && size <= 25 * 1024 * 1024) {
    return size
  }
  return DEFAULT_IMAGE_MAX_SIZE_BYTES
}
