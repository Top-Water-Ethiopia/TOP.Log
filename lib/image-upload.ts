import type { CloudinaryUploadAsset } from "@/lib/cloudinary"

export type ImageUploadMode = "single" | "multiple"

export type AttributedCloudinaryAsset = CloudinaryUploadAsset & {
  uploadedByUserId?: string
  uploadedByDisplayName?: string
  uploadedAt?: string
}

export function isAttributedCloudinaryAsset(value: unknown): value is AttributedCloudinaryAsset {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<AttributedCloudinaryAsset>
  return candidate.provider === "cloudinary" && typeof candidate.secureUrl === "string"
}

export function isAttributedCloudinaryAssetArray(value: unknown): value is AttributedCloudinaryAsset[] {
  return Array.isArray(value) && value.every((item) => isAttributedCloudinaryAsset(item))
}

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
