"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { LogAsset } from "@/lib/log-assets"
import { FilesMediaViewerDialog } from "@/components/logs/files-media-viewer-dialog"

interface FilesMediaGridProps {
  assets: LogAsset[]
  getOpenReportHref?: (entryId: string) => string
}

export function FilesMediaGrid({ assets, getOpenReportHref }: FilesMediaGridProps) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  const sorted = useMemo(() => assets, [assets])

  if (assets.length === 0) {
    return <p className="text-muted-foreground text-sm">No media uploaded.</p>
  }

  return (
    <>
      <FilesMediaViewerDialog
        assets={sorted}
        open={open}
        index={index}
        onOpenChange={setOpen}
        onIndexChange={setIndex}
        getOpenReportHref={getOpenReportHref}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((asset, assetIndex) => (
          <button
            key={asset.id}
            type="button"
            className="group relative overflow-hidden rounded-lg border bg-white text-left"
            title={asset.filename}
            onClick={() => {
              setIndex(assetIndex)
              setOpen(true)
            }}
          >
            <div className="aspect-square w-full bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.filename}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            </div>
            <div className="bg-background/80 absolute inset-x-0 bottom-0 space-y-0.5 px-2 py-1 text-xs backdrop-blur">
              <div className="line-clamp-1">{asset.filename}</div>
              {getOpenReportHref ? (
                <Link
                  href={getOpenReportHref(asset.entryId)}
                  className="text-primary block text-[11px] hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open report
                </Link>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
