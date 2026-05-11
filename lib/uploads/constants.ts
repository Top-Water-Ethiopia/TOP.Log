export const UPLOAD_PROVIDER_CLOUDINARY = "cloudinary"

// Defensive guard to avoid pathological payload traversal in analytics endpoints.
export const MAX_UPLOAD_ITEMS_PER_RESPONSE = 1000

// Accept common spellings from older payloads.
export const COMPAT_URL_FIELDS = ["secureUrl", "secure_url", "url"] as const

// Optional resource markers used by some Cloudinary payload variants.
export const COMPAT_RESOURCE_TYPE_FIELDS = ["resourceType", "resource_type"] as const
export const VALID_IMAGE_RESOURCE_TYPES = ["image"] as const

