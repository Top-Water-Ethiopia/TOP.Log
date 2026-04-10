import {
  getImageUploadMode,
  isAttributedCloudinaryAsset,
  isAttributedCloudinaryAssetArray,
  normalizeImageResponseValue,
} from "@/lib/image-upload"

describe("image upload helpers", () => {
  const asset = {
    provider: "cloudinary" as const,
    resourceType: "image" as const,
    publicId: "captain-log/sample",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    originalFilename: "sample.jpg",
    bytes: 1024,
    format: "jpg",
  }

  it("normalizes a scalar asset into an array", () => {
    expect(normalizeImageResponseValue(asset)).toEqual([asset])
  })

  it("filters malformed mixed arrays to valid assets only", () => {
    expect(normalizeImageResponseValue([asset, null, { nope: true }])).toEqual([asset])
  })

  it("returns an empty array for malformed scalar values", () => {
    expect(normalizeImageResponseValue(12345)).toEqual([])
  })

  it("detects attributed asset arrays and defaults image upload mode to single", () => {
    expect(isAttributedCloudinaryAsset(asset)).toBe(true)
    expect(isAttributedCloudinaryAssetArray([asset])).toBe(true)
    expect(getImageUploadMode(undefined)).toBe("single")
    expect(getImageUploadMode({ image_upload_mode: "multiple" })).toBe("multiple")
  })
})
