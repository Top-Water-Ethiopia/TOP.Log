"use client"

import { useState, useRef } from "react"
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
import { Upload, FileJson, AlertCircle } from "lucide-react"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { importFromJSON } from "@/lib/export-utils"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function ImportDialog() {
  const { entries, addEntry } = useCaptainLog()
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      toast.error("Please select a valid JSON file")
      return
    }

    setSelectedFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select a file")
      return
    }

    try {
      const text = await selectedFile.text()
      const importedEntries = importFromJSON(text)

      if (importedEntries.length === 0) {
        toast.error("No valid entries found in file")
        return
      }

      // Check for duplicates
      const existingDates = new Set(entries.map((e) => e.date))
      const newEntries = importedEntries.filter((e) => !existingDates.has(e.date))
      const duplicates = importedEntries.length - newEntries.length

      // Add new entries
      newEntries.forEach((entry) => {
        const entryData = entry as any
        addEntry({
          date: entry.date,
          // New fields (v2.4.0)
          objectives: entryData.objectives || "",
          keyResults: entryData.keyResults || "",
          challenges: entryData.challenges || "",
          // Legacy fields
          developmentTasks: entry.developmentTasks,
          featuresCompleted: entry.featuresCompleted,
          challengesAndBlockers: entry.challengesAndBlockers,
          codeAndPriorities: entry.codeAndPriorities,
          systemImprovements: entry.systemImprovements,
          projectUpdates: entry.projectUpdates,
        })
      })

      toast.success(
        `Imported ${newEntries.length} entries successfully!${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ""}`
      )

      setIsOpen(false)
      setSelectedFile(null)
    } catch (error) {
      console.error("Import failed:", error)
      toast.error("Failed to import data. Please check the file format.")
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Log Entries</DialogTitle>
          <DialogDescription>Import entries from a previously exported JSON file.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Duplicate entries (same date) will be skipped automatically.</AlertDescription>
          </Alert>

          {/* File Upload Area */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {selectedFile ? (
              <div>
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-foreground mb-1">Drop JSON file here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Current Entries Info */}
          {entries.length > 0 && (
            <div className="text-sm text-muted-foreground">Current entries in database: {entries.length}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!selectedFile}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
