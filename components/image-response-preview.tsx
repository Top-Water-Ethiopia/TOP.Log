"use client"

import { useMemo, useState } from "react"
import { ImageOff } from "lucide-react"
import { type AttributedCloudinaryAsset, normalizeImageResponseValue } from "@/lib/image-upload"
import { cn } from "@/lib/utils"

interface ImageResponsePreviewProps {
  value: unknown
  className?: string
}

function getAssetLabel(asset: AttributedCloudinaryAsset) {
  if (asset.originalFilename && asset.originalFilename.trim().length > 0) {
    return asset.originalFilename
  }

  const publicIdSegments = asset.publicId.split("/").filter(Boolean)
  return publicIdSegments.at(-1) || "Uploaded image"
}

function getAssetAltText(asset: AttributedCloudinaryAsset) {
  if (asset.originalFilename && asset.originalFilename.trim().length > 0) {
    return asset.originalFilename
  }

  const publicIdSegments = asset.publicId.split("/").filter(Boolean)
  return publicIdSegments.at(-1) || "Uploaded image preview"
}

function ImageResponsePreviewItem({ asset }: { asset: AttributedCloudinaryAsset }) {
  const [didImageFail, setDidImageFail] = useState(false)
  const label = getAssetLabel(asset)
  const altText = getAssetAltText(asset)
  const metadataParts = [
    asset.uploadedByDisplayName ? `Uploaded by ${asset.uploadedByDisplayName}` : null,
    asset.uploadedAt ? new Date(asset.uploadedAt).toLocaleString() : null,
  ].filter((part): part is string => Boolean(part))

  return (
    <div className="space-y-2">
      <a
        href={asset.secureUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <div className="bg-muted/40 border-border/60 aspect-square overflow-hidden rounded-md border">
          {didImageFail ? (
            <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
              <ImageOff className="h-5 w-5" />
              <span>Preview unavailable</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.secureUrl}
              alt={altText}
              className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
              onError={() => setDidImageFail(true)}
            />
          )}
        </div>
      </a>
      <div className="space-y-1">
        <a
          href={asset.secureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary block truncate text-sm hover:underline"
          title={label}
        >
          {label}
        </a>
        {metadataParts.length > 0 ? <p className="text-muted-foreground text-xs">{metadataParts.join(" • ")}</p> : null}
      </div>
    </div>
  )
}

export function ImageResponsePreview({ value, className }: ImageResponsePreviewProps) {
  const assets = useMemo(() => normalizeImageResponseValue(value), [value])

  if (assets.length === 0) {
    return <p className="text-muted-foreground text-sm">No images uploaded</p>
  }

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {assets.map((asset, index) => (
        <ImageResponsePreviewItem key={`${asset.publicId}-${index}`} asset={asset} />
      ))}
    </div>
  )
}
