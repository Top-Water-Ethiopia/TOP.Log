import {
  compareLogAssetsNewestFirst,
  dedupeLogAssetsKeepingNewest,
  extractLogAssetsFromResponses,
  getAssetFilename,
} from "@/lib/log-assets"
import { canAccessLog, type AccessContext } from "@/lib/logs/visibility"
import type { AttributedCloudinaryAsset } from "@/lib/upload-types"

function makeAsset(overrides: Partial<AttributedCloudinaryAsset> = {}): AttributedCloudinaryAsset {
  return {
    provider: "cloudinary",
    resourceType: "raw",
    publicId: "p1",
    secureUrl: "https://example.com/p1",
    originalFilename: "file.pdf",
    bytes: 123,
    format: "pdf",
    ...overrides,
  }
}

describe("log-assets", () => {
  test("extractLogAssetsFromResponses ignores non image/file types and malformed values", () => {
    const responses = [
      { question_type: "text", question_key: "a", question_label: "A", value: "hello" },
      { question_type: "image", question_key: "img", question_label: "Img", value: null },
      { question_type: "file", question_key: "doc", question_label: "Doc", value: { nope: true } },
    ]

    const assets = extractLogAssetsFromResponses(responses, {
      entryId: "e1",
      entryDate: "2026-04-17",
      entryCreatedAt: "2026-04-17T10:00:00.000Z",
      entryUserId: "u1",
    })

    expect(assets).toHaveLength(0)
  })

  test("extractLogAssetsFromResponses normalizes single assets and arrays", () => {
    const image = makeAsset({
      resourceType: "image",
      publicId: "img1",
      secureUrl: "https://example.com/img1",
      originalFilename: "photo.jpg",
      format: "jpg",
      uploadedByUserId: "u1",
      uploadedAt: "2026-04-17T12:00:00.000Z",
    })

    const doc1 = makeAsset({
      resourceType: "raw",
      publicId: "doc1",
      secureUrl: "https://example.com/doc1",
      originalFilename: "doc.pdf",
      format: "pdf",
      uploadedByUserId: "u1",
      uploadedAt: "2026-04-17T11:00:00.000Z",
    })

    const doc2 = makeAsset({
      resourceType: "raw",
      publicId: "doc2",
      secureUrl: "https://example.com/doc2",
      originalFilename: "sheet.xlsx",
      format: "xlsx",
      uploadedByUserId: "u1",
      uploadedAt: "2026-04-17T10:00:00.000Z",
    })

    const responses = [
      { question_type: "image", question_key: "img", question_label: "Img", value: image },
      { question_type: "file", question_key: "doc", question_label: "Doc", value: [doc1, doc2] },
    ]

    const assets = extractLogAssetsFromResponses(responses, { entryId: "e1" })

    expect(assets).toHaveLength(3)
    expect(assets.find((a) => a.id === "img1")?.kind).toBe("image")
    expect(assets.find((a) => a.id === "doc1")?.kind).toBe("document")
  })

  test("canAccessLog uses roles and ownership correctly", () => {
    const ctx: AccessContext = {
      userId: "u1",
      departmentAccess: new Map([["dept1", "department-lead"]]),
    }

    // Owner access
    expect(canAccessLog({ user_id: "u1", department_id: "dept1" }, ctx)).toBe(true)
    
    // Lead access (cross-user)
    expect(canAccessLog({ user_id: "u2", department_id: "dept1" }, ctx)).toBe(true)

    // No access (other department)
    expect(canAccessLog({ user_id: "u2", department_id: "dept2" }, ctx)).toBe(false)
  })

  test("getAssetFilename falls back to publicId then Untitled file", () => {
    expect(getAssetFilename(makeAsset({ originalFilename: "  " }))).toBe("p1")
    expect(getAssetFilename({ originalFilename: "  ", publicId: "   " })).toBe("Untitled file")
  })

  test("compareLogAssetsNewestFirst is deterministic (ASC stable fallback)", () => {
    const base = { entryId: "e1", filename: "x", kind: "document" as const, url: "u" }
    const a = { ...base, id: "a", uploadedAt: undefined, entryCreatedAt: null, entryDate: undefined }
    const b = { ...base, id: "b", uploadedAt: undefined, entryCreatedAt: null, entryDate: undefined }
    expect(compareLogAssetsNewestFirst(a as any, b as any)).toBeLessThan(0)
  })

  test("dedupeLogAssetsKeepingNewest keeps newest duplicate", () => {
    const older = {
      id: "same",
      kind: "document" as const,
      url: "https://example.com/same",
      filename: "old.pdf",
      uploadedAt: "2026-04-17T10:00:00.000Z",
      entryId: "e1",
    }
    const newer = {
      ...older,
      filename: "new.pdf",
      uploadedAt: "2026-04-17T11:00:00.000Z",
    }

    const deduped = dedupeLogAssetsKeepingNewest([older as any, newer as any])
    expect(deduped).toHaveLength(1)
    expect(deduped[0].filename).toBe("new.pdf")
  })
})

