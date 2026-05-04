"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LogAsset } from "@/lib/log-assets"
import { FilesDocsList } from "@/components/logs/files-docs-list"
import { FilesMediaGrid } from "@/components/logs/files-media-grid"

interface FilesTabsProps {
  docs: LogAsset[]
  media: LogAsset[]
  initialTab?: "media" | "docs"
  value?: "media" | "docs"
  onValueChange?: (value: "media" | "docs") => void
  getOpenReportHref?: (entryId: string) => string
}

export function FilesTabs({
  docs,
  media,
  initialTab = "media",
  value,
  onValueChange,
  getOpenReportHref,
}: FilesTabsProps) {
  return (
    <Tabs
      defaultValue={initialTab}
      value={value}
      onValueChange={onValueChange ? (next) => onValueChange(next as "media" | "docs") : undefined}
    >
      <TabsList>
        <TabsTrigger value="media">Media ({media.length})</TabsTrigger>
        <TabsTrigger value="docs">Docs ({docs.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="media" className="pt-2">
        <FilesMediaGrid assets={media} getOpenReportHref={getOpenReportHref} />
      </TabsContent>
      <TabsContent value="docs" className="pt-2">
        <FilesDocsList assets={docs} getOpenReportHref={getOpenReportHref} />
      </TabsContent>
    </Tabs>
  )
}
