import {
  COMPAT_RESOURCE_TYPE_FIELDS,
  COMPAT_URL_FIELDS,
  MAX_UPLOAD_ITEMS_PER_RESPONSE,
  UPLOAD_PROVIDER_CLOUDINARY,
  VALID_IMAGE_RESOURCE_TYPES,
} from "./constants"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function readFirstStringField(obj: UnknownRecord, fields: readonly string[]): string | null {
  for (const key of fields) {
    const value = obj[key]
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}

function hasImageResourceMarker(obj: UnknownRecord): boolean {
  const marker = readFirstStringField(obj, COMPAT_RESOURCE_TYPE_FIELDS)
  return marker ? VALID_IMAGE_RESOURCE_TYPES.some((resourceType) => resourceType === marker) : false
}

function hasCompatUrl(obj: UnknownRecord): boolean {
  return readFirstStringField(obj, COMPAT_URL_FIELDS) != null
}

/**
 * Validates that a value looks like a Cloudinary upload asset.
 *
 * Strict shape: provider=cloudinary AND publicId is present.
 * Compat shape: provider=cloudinary AND url present AND explicit image resource marker.
 *
 * IMPORTANT: Never treat url alone as an uploaded asset.
 */
export function isValidUploadedImageAsset(value: unknown): boolean {
  if (!isRecord(value)) return false

  const provider = typeof value.provider === "string" ? value.provider.trim() : ""
  if (provider !== UPLOAD_PROVIDER_CLOUDINARY) return false

  const publicId = typeof value.publicId === "string" ? value.publicId.trim() : ""
  if (publicId) return true

  // Backward-compat: still require provider marker + URL + resource marker.
  return hasCompatUrl(value) && hasImageResourceMarker(value)
}

export function countUploadedAssets(value: unknown): number {
  if (Array.isArray(value)) {
    const capped = value.length > MAX_UPLOAD_ITEMS_PER_RESPONSE ? value.slice(0, MAX_UPLOAD_ITEMS_PER_RESPONSE) : value
    let count = 0
    for (const item of capped) {
      if (isValidUploadedImageAsset(item)) count++
    }
    return count
  }

  return isValidUploadedImageAsset(value) ? 1 : 0
}
