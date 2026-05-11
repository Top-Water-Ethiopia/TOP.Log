import { countUploadedAssets, isValidUploadedImageAsset } from "@/lib/uploads/validate-uploaded-image-asset"

describe("upload asset validation", () => {
  it("accepts strict cloudinary assets with publicId", () => {
    expect(
      isValidUploadedImageAsset({
        provider: "cloudinary",
        publicId: "abc123",
      })
    ).toBe(true)
  })

  it("rejects url-only objects (even if provider matches)", () => {
    expect(
      isValidUploadedImageAsset({
        provider: "cloudinary",
        secure_url: "https://example.com/x.png",
        foo: "bar",
      })
    ).toBe(false)
  })

  it("accepts compat cloudinary assets with url + image resource marker", () => {
    expect(
      isValidUploadedImageAsset({
        provider: "cloudinary",
        secure_url: "https://example.com/x.png",
        resource_type: "image",
      })
    ).toBe(true)
  })

  it("counts only valid items in mixed arrays", () => {
    const value = [
      { provider: "cloudinary", publicId: "a" },
      null,
      {},
      "abc",
      { provider: "cloudinary", secure_url: "https://example.com/x.png", resource_type: "image" },
      { provider: "cloudinary", secure_url: "https://example.com/x.png" },
    ]
    expect(countUploadedAssets(value)).toBe(2)
  })

  it("counts single objects as 1 only when valid", () => {
    expect(countUploadedAssets({ provider: "cloudinary", publicId: "a" })).toBe(1)
    expect(countUploadedAssets({})).toBe(0)
    expect(countUploadedAssets(null)).toBe(0)
  })
})

