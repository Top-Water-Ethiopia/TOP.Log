"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { LogAsset } from "@/lib/log-assets"
import { formatUploadTimestamp } from "@/lib/upload-types"

interface FilesMediaViewerDialogProps {
  assets: LogAsset[]
  open: boolean
  index: number
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
  getOpenReportHref?: (entryId: string) => string
}

export function FilesMediaViewerDialog({
  assets,
  open,
  index,
  onOpenChange,
  onIndexChange,
  getOpenReportHref,
}: FilesMediaViewerDialogProps) {
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, assets.length - 1)))
  const asset = assets[safeIndex]

  const canNavigate = assets.length > 1

  const prevIndex = useMemo(() => (safeIndex - 1 + assets.length) % assets.length, [assets.length, safeIndex])
  const nextIndex = useMemo(() => (safeIndex + 1) % assets.length, [assets.length, safeIndex])

  useEffect(() => {
    if (!open) return
    if (!canNavigate) return
    const next = assets[nextIndex]
    if (!next?.url) return
    const img = new Image()
    img.src = next.url
  }, [assets, canNavigate, nextIndex, open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        if (canNavigate) onIndexChange(prevIndex)
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        if (canNavigate) onIndexChange(nextIndex)
      }
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canNavigate, nextIndex, onIndexChange, onOpenChange, open, prevIndex])

  if (!asset) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 grid h-screen w-screen translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-black p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{asset.filename}</DialogTitle>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{asset.filename}</div>
            <div className="text-xs text-white/70">
              {asset.uploadedAt ? formatUploadTimestamp(asset.uploadedAt) : asset.entryDate || "—"} · {safeIndex + 1} /{" "}
              {assets.length}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {getOpenReportHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={getOpenReportHref(asset.entryId)}>Open report</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <a href={asset.url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open file
              </a>
            </Button>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        <div className="relative flex h-[calc(100vh-56px)] items-center justify-center">
          {canNavigate ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={() => onIndexChange(prevIndex)}
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Previous</span>
            </Button>
          ) : null}

          <div className="flex h-full w-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={asset.filename} className="max-h-[90vh] max-w-[95vw] object-contain" />
          </div>

          {canNavigate ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={() => onIndexChange(nextIndex)}
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Next</span>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
