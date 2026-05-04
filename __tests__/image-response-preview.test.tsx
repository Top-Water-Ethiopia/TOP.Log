import { fireEvent, render, screen } from "@testing-library/react"
import { ImageResponsePreview } from "@/components/image-response-preview"

describe("ImageResponsePreview", () => {
  const baseAsset = {
    provider: "cloudinary" as const,
    resourceType: "image" as const,
    publicId: "captain-log/sample/photo-1",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/photo-1.jpg",
    originalFilename: "photo-1.jpg",
    bytes: 1024,
    format: "jpg",
    uploadedByDisplayName: "Sam Reporter",
    uploadedAt: "2026-04-10T14:25:00Z",
  }

  it("renders a single image preview with metadata and secure link attributes", () => {
    render(<ImageResponsePreview value={[baseAsset]} />)

    const imageLinks = screen.getAllByRole("link", { name: "photo-1.jpg" })
    expect(imageLinks).toHaveLength(2)
    expect(imageLinks[0]).toHaveAttribute("href", baseAsset.secureUrl)
    expect(imageLinks[0]).toHaveAttribute("target", "_blank")
    expect(imageLinks[0]).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.getByAltText("photo-1.jpg")).toBeInTheDocument()
    expect(screen.getByText(/Uploaded by Sam Reporter/)).toBeInTheDocument()
  })

  it("renders multiple images in the normalized order", () => {
    render(
      <ImageResponsePreview
        value={[
          baseAsset,
          {
            ...baseAsset,
            publicId: "captain-log/sample/photo-2",
            secureUrl: "https://res.cloudinary.com/demo/image/upload/photo-2.jpg",
            originalFilename: "photo-2.jpg",
          },
        ]}
      />
    )

    expect(screen.getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual(["photo-1.jpg", "photo-2.jpg"])
  })

  it("supports legacy scalar image values", () => {
    render(<ImageResponsePreview value={baseAsset} />)

    expect(screen.getByAltText("photo-1.jpg")).toBeInTheDocument()
  })

  it("shows a fallback when no valid images are available", () => {
    render(<ImageResponsePreview value={[]} />)

    expect(screen.getByText("No images uploaded")).toBeInTheDocument()
  })

  it("falls back to the public id segment when filename is missing", () => {
    render(
      <ImageResponsePreview
        value={[
          {
            ...baseAsset,
            publicId: "captain-log/uploads/very-long-generated-name",
            originalFilename: "",
          },
        ]}
      />
    )

    const fallbackLabel = screen.getByText("very-long-generated-name")
    expect(fallbackLabel).toHaveClass("truncate")
  })

  it("shows a stable placeholder when image loading fails", () => {
    render(<ImageResponsePreview value={[baseAsset]} />)

    fireEvent.error(screen.getByAltText("photo-1.jpg"))

    expect(screen.getByText("Preview unavailable")).toBeInTheDocument()
    expect(screen.getByText("photo-1.jpg")).toBeInTheDocument()
  })

  it("provides a generic alt text fallback when neither filename nor public id are usable", () => {
    render(
      <ImageResponsePreview
        value={[
          {
            ...baseAsset,
            publicId: "/",
            originalFilename: "",
          },
        ]}
      />
    )

    expect(screen.getByAltText("Uploaded image preview")).toBeInTheDocument()
  })
})
