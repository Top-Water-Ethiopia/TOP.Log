"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download, FileJson, FileText, FileSpreadsheet } from "lucide-react"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { downloadCSV, downloadJSON, downloadMarkdown, getDateRangeSummary } from "@/lib/export-utils"
import { toast } from "sonner"

type ExportFormat = "csv" | "json" | "markdown"

export function ExportDialog() {
  const { entries } = useCaptainLog()
  const [format, setFormat] = useState<ExportFormat>("json")
  const [isOpen, setIsOpen] = useState(false)

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error("No entries to export")
      return
    }

    try {
      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `captain-log-${timestamp}`

      switch (format) {
        case "csv":
          downloadCSV(entries, `${filename}.csv`)
          toast.success("Exported to CSV successfully!")
          break
        case "json":
          downloadJSON(entries, `${filename}.json`)
          toast.success("Exported to JSON successfully!")
          break
        case "markdown":
          downloadMarkdown(entries, `${filename}.md`)
          toast.success("Exported to Markdown successfully!")
          break
      }

      setIsOpen(false)
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Failed to export data")
    }
  }

  const summary = getDateRangeSummary(entries)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Log Entries</DialogTitle>
          <DialogDescription>
            Choose a format to export your log entries. All {entries.length} entries will be included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          {summary.totalDays > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="font-medium mb-1">Export Summary</div>
              <div className="text-muted-foreground space-y-1">
                <div>Total Entries: {summary.totalDays}</div>
                {summary.earliest && <div>Date Range: {summary.earliest} - {summary.latest}</div>}
              </div>
            </div>
          )}

          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 flex-1 cursor-pointer">
                  <FileJson className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-medium">JSON</div>
                    <div className="text-xs text-muted-foreground">Best for backup and data portability</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 flex-1 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-medium">CSV</div>
                    <div className="text-xs text-muted-foreground">Open in Excel or Google Sheets</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="markdown" id="markdown" />
                <Label htmlFor="markdown" className="flex items-center gap-2 flex-1 cursor-pointer">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <div>
                    <div className="font-medium">Markdown</div>
                    <div className="text-xs text-muted-foreground">Human-readable formatted document</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
