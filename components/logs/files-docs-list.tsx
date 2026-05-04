"use client"

import Link from "next/link"
import { FileArchive, FileSpreadsheet, FileText, FileType, FileUp } from "lucide-react"
import type { LogAsset } from "@/lib/log-assets"
import { formatUploadTimestamp } from "@/lib/upload-types"

function pickDocIcon(asset: LogAsset) {
  const name = asset.filename.toLowerCase()
  const ext = name.includes(".") ? name.split(".").pop() || "" : ""
  const format = (asset.format || "").toLowerCase()
  const key = ext || format

  if (["xlsx", "xls", "csv"].includes(key)) return FileSpreadsheet
  if (["zip", "rar", "7z", "tar", "gz"].includes(key)) return FileArchive
  if (["pdf", "doc", "docx", "ppt", "pptx", "txt", "md"].includes(key)) return FileText
  return FileType
}

interface FilesDocsListProps {
  assets: LogAsset[]
  getOpenReportHref?: (entryId: string) => string
}

export function FilesDocsList({ assets, getOpenReportHref }: FilesDocsListProps) {
  if (assets.length === 0) {
    return <p className="text-muted-foreground text-sm">No documents uploaded.</p>
  }

  return (
    <div className="space-y-2">
      {assets.map((asset) => {
        const Icon = pickDocIcon(asset)
        return (
          <div key={asset.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{asset.filename}</div>
                <div className="text-muted-foreground text-xs">
                  {asset.uploadedAt ? formatUploadTimestamp(asset.uploadedAt) : "—"}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {getOpenReportHref ? (
                <Link href={getOpenReportHref(asset.entryId)} className="text-primary text-xs hover:underline">
                  Open report
                </Link>
              ) : null}
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                <FileUp className="h-3.5 w-3.5" />
                Open
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}
