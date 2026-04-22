"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilesTabs } from "@/components/logs/files-tabs"
import { compareLogAssetsNewestFirst, dedupeLogAssetsKeepingNewest, type LogAsset } from "@/lib/log-assets"
import { buildLogsPageHref } from "@/lib/logs-page-filters"
import { FILES_MAX_ENTRY_SCAN, FILES_TARGET_ASSETS } from "@/lib/log-files-constants"

type Cursor = { createdAt: string; id: string } | null

interface FilesApiResponse {
  data?: {
    assets: LogAsset[]
    nextCursor: Cursor
    hasMore: boolean
  }
  error?: string
}

interface LogsFilesViewProps {
  currentUserId: string
  departmentId?: string
  date?: string
  month?: string
}

function MediaSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="aspect-square w-full animate-pulse rounded-lg border bg-slate-50" />
      ))}
    </div>
  )
}

function DocsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-md bg-slate-100" />
            <div className="min-w-0">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-7 w-20 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function LogsFilesView({ currentUserId, departmentId, date, month }: LogsFilesViewProps) {
  const [activeTab, setActiveTab] = useState<"media" | "docs">("media")
  const [assets, setAssets] = useState<LogAsset[]>([])
  const [cursor, setCursor] = useState<Cursor>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getOpenReportHref = useCallback(
    (entryId: string) =>
      buildLogsPageHref({
        view: "files",
        departmentId,
        date,
        month,
        selectedLogId: entryId,
      }),
    [date, departmentId, month]
  )

  const merged = useMemo(() => {
    return dedupeLogAssetsKeepingNewest(assets).sort(compareLogAssetsNewestFirst)
  }, [assets])

  const media = useMemo(() => merged.filter((a) => a.kind === "image"), [merged])
  const docs = useMemo(() => merged.filter((a) => a.kind === "document"), [merged])

  const activeCount = activeTab === "media" ? media.length : docs.length

  const fetchNext = useCallback(async () => {
    if (isFetching || !hasMore) return
    setIsFetching(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("targetAssets", String(FILES_TARGET_ASSETS))
      params.set("maxEntriesScanned", String(FILES_MAX_ENTRY_SCAN))
      if (departmentId) params.set("departmentId", departmentId)
      if (cursor?.createdAt && cursor?.id) {
        params.set("cursorCreatedAt", cursor.createdAt)
        params.set("cursorId", cursor.id)
      }

      const response = await fetch(`/api/logs/files?${params.toString()}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as FilesApiResponse
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }

      const nextAssets = payload.data?.assets || []
      const nextCursor = payload.data?.nextCursor ?? null
      const nextHasMore = payload.data?.hasMore ?? false

      setAssets((prev) => [...prev, ...nextAssets])
      setCursor(nextCursor)
      setHasMore(nextHasMore)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load files")
    } finally {
      setIsFetching(false)
    }
  }, [cursor, departmentId, hasMore, isFetching])

  // Reset when department changes.
  useEffect(() => {
    setAssets([])
    setCursor(null)
    setHasMore(true)
    setError(null)
  }, [departmentId, currentUserId])

  // Initial load.
  useEffect(() => {
    if (assets.length > 0) return
    if (isFetching) return
    if (!hasMore) return
    void fetchNext()
  }, [assets.length, fetchNext, hasMore, isFetching])

  // Tab switch auto-fill.
  useEffect(() => {
    if (isFetching) return
    if (!hasMore) return
    if (activeCount >= FILES_TARGET_ASSETS) return
    void fetchNext()
  }, [activeCount, activeTab, fetchNext, hasMore, isFetching])

  const isEmpty = media.length === 0 && docs.length === 0

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Could not load files</div>
          <div className="mt-1">{error}</div>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => fetchNext()} disabled={isFetching}>
            Retry
          </Button>
        </div>
      ) : null}

      {isEmpty && isFetching ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-36 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-slate-100" />
          </div>
          {activeTab === "media" ? <MediaSkeleton /> : <DocsSkeleton />}
          <div className="flex items-center justify-end">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        </div>
      ) : isEmpty ? (
        <div className="text-muted-foreground rounded-lg border bg-white p-8 text-center text-sm">
          {departmentId
            ? "No files found for your uploads in this department."
            : "No files found for your uploads yet."}
        </div>
      ) : (
        <FilesTabs
          media={media}
          docs={docs}
          value={activeTab}
          onValueChange={setActiveTab}
          getOpenReportHref={getOpenReportHref}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-xs">
          Showing {activeCount} {activeTab === "media" ? "media" : "doc"} item{activeCount === 1 ? "" : "s"} loaded
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchNext()} disabled={!hasMore || isFetching}>
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </>
          ) : hasMore ? (
            "Load more"
          ) : (
            "No more"
          )}
        </Button>
      </div>
    </div>
  )
}
