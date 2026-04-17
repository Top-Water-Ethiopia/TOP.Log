import type { AttributedCloudinaryAsset } from "@/lib/upload-types"
import { isAttributedCloudinaryAsset, isAttributedCloudinaryAssetArray } from "@/lib/upload-types"

export type LogAssetKind = "image" | "document"

export type LogAsset = {
  id: string
  kind: LogAssetKind
  url: string
  filename: string
  bytes?: number
  format?: string | null
  mimeType?: string
  uploadedAt?: string
  uploadedByUserId?: string
  entryId: string
  entryDate?: string
  entryCreatedAt?: string | null
  entryUserId?: string | null
  questionKey?: string
  questionLabel?: string | null
}

export type LogAssetSourceResponse = {
  question_type?: string | null
  question_key?: string | null
  question_label?: string | null
  value: unknown
}

export type LogAssetEntryContext = {
  entryId: string
  entryDate?: string
  entryCreatedAt?: string | null
  entryUserId?: string | null
}

export function getAssetFilename(asset: Partial<AttributedCloudinaryAsset>): string {
  const filename = typeof asset.originalFilename === "string" ? asset.originalFilename.trim() : ""
  if (filename) return filename
  const publicId = typeof asset.publicId === "string" ? asset.publicId.trim() : ""
  if (publicId) return publicId
  return "Untitled file"
}

export function getAssetKind(asset: Pick<AttributedCloudinaryAsset, "resourceType">): LogAssetKind {
  return asset.resourceType === "image" ? "image" : "document"
}

export function shouldIncludeAssetForUser(
  asset: Pick<AttributedCloudinaryAsset, "uploadedByUserId">,
  context: Pick<LogAssetEntryContext, "entryUserId">,
  currentUserId: string
): boolean {
  if (asset.uploadedByUserId && asset.uploadedByUserId === currentUserId) return true
  return !!context.entryUserId && context.entryUserId === currentUserId
}

function normalizeAssets(value: unknown): AttributedCloudinaryAsset[] {
  if (isAttributedCloudinaryAssetArray(value)) return value
  if (isAttributedCloudinaryAsset(value)) return [value]
  if (Array.isArray(value)) return value.filter(isAttributedCloudinaryAsset)
  return []
}

function buildStableId(asset: Pick<AttributedCloudinaryAsset, "publicId" | "secureUrl">): string {
  const publicId = asset.publicId?.trim()
  if (publicId) return publicId
  const url = asset.secureUrl?.trim()
  if (url) return url
  return "unknown"
}

export function extractLogAssetsFromResponses(
  responses: LogAssetSourceResponse[],
  context: LogAssetEntryContext
): LogAsset[] {
  const assets: LogAsset[] = []

  for (const response of responses) {
    const questionType = response.question_type ?? "text"
    if (questionType !== "image" && questionType !== "file") continue

    const normalized = normalizeAssets(response.value)
    for (const asset of normalized) {
      assets.push({
        id: buildStableId(asset),
        kind: getAssetKind(asset),
        url: asset.secureUrl,
        filename: getAssetFilename(asset),
        bytes: asset.bytes,
        format: asset.format,
        uploadedAt: asset.uploadedAt,
        uploadedByUserId: asset.uploadedByUserId,
        entryId: context.entryId,
        entryDate: context.entryDate,
        entryCreatedAt: context.entryCreatedAt,
        entryUserId: context.entryUserId,
        questionKey: response.question_key ?? undefined,
        questionLabel: response.question_label ?? null,
      })
    }
  }

  return assets
}

export function compareLogAssetsNewestFirst(left: LogAsset, right: LogAsset): number {
  const leftUploadedAt = left.uploadedAt ? Date.parse(left.uploadedAt) : NaN
  const rightUploadedAt = right.uploadedAt ? Date.parse(right.uploadedAt) : NaN
  if (!Number.isNaN(leftUploadedAt) || !Number.isNaN(rightUploadedAt)) {
    if (Number.isNaN(leftUploadedAt)) return 1
    if (Number.isNaN(rightUploadedAt)) return -1
    if (leftUploadedAt !== rightUploadedAt) return rightUploadedAt - leftUploadedAt
  }

  const leftCreatedAt = left.entryCreatedAt ? Date.parse(left.entryCreatedAt) : NaN
  const rightCreatedAt = right.entryCreatedAt ? Date.parse(right.entryCreatedAt) : NaN
  if (!Number.isNaN(leftCreatedAt) || !Number.isNaN(rightCreatedAt)) {
    if (Number.isNaN(leftCreatedAt)) return 1
    if (Number.isNaN(rightCreatedAt)) return -1
    if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt
  }

  if (left.entryDate || right.entryDate) {
    const leftDate = left.entryDate || ""
    const rightDate = right.entryDate || ""
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
  }

  const leftStable = (left.id || left.url || "").trim()
  const rightStable = (right.id || right.url || "").trim()
  return leftStable.localeCompare(rightStable) // ASC fallback for determinism
}

export function dedupeLogAssetsKeepingNewest(assets: LogAsset[]): LogAsset[] {
  const sorted = [...assets].sort(compareLogAssetsNewestFirst)
  const seen = new Set<string>()
  const result: LogAsset[] = []

  for (const asset of sorted) {
    const key = asset.id || asset.url
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push(asset)
  }

  return result
}
