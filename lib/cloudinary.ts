import { createHash } from "crypto"

export type CloudinaryResourceType = "image" | "raw" | "auto"

export interface CloudinaryUploadAsset {
  provider: "cloudinary"
  resourceType: CloudinaryResourceType
  publicId: string
  secureUrl: string
  originalFilename: string
  bytes: number
  format: string | null
}

export interface CloudinaryUploadSignaturePayload {
  timestamp: number
  folder?: string
  resourceType: CloudinaryResourceType
}

function getRequiredEnv(name: keyof NodeJS.ProcessEnv) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getCloudinaryConfig() {
  return {
    cloudName: getRequiredEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    apiKey: getRequiredEnv("NEXT_PUBLIC_CLOUDINARY_API_KEY"),
    apiSecret: getRequiredEnv("CLOUDINARY_API_SECRET"),
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "captain-log",
  }
}

export function createCloudinarySignature(payload: CloudinaryUploadSignaturePayload) {
  const { apiSecret } = getCloudinaryConfig()
  const entries = Object.entries({
    folder: payload.folder,
    timestamp: String(payload.timestamp),
  }).filter(([, value]) => typeof value === "string" && value.length > 0)

  const signatureBase = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  return createHash("sha1").update(`${signatureBase}${apiSecret}`).digest("hex")
}
