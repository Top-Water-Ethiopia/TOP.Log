"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Upload, FileText, X, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { FILE_ACCEPTED_TYPES, FILE_ACCEPTED_EXTENSIONS, FILE_MAX_FILES } from "@/lib/upload-config"
import type { AttributedCloudinaryAsset, FileUploadMode } from "@/lib/upload-types"
import { isAttributedCloudinaryAsset, formatUploadTimestamp, DEFAULT_FILE_MAX_SIZE_BYTES } from "@/lib/upload-types"

// Slot-based upload tracking for multiple files
type FileUploadSlot = {
  id: string
  file: File
  status: "pending" | "success" | "error"
  progressPercent: number
  asset?: AttributedCloudinaryAsset
  error?: string
}

interface FileUploadFieldProps {
  questionKey: string
  value: unknown
  mode?: FileUploadMode // defaults to "single"
  maxFiles?: number // defaults to FILE_MAX_FILES
  maxSizeBytes?: number // defaults to DEFAULT_FILE_MAX_SIZE_BYTES (25MB)
  uploadState?: { isUploading: boolean; error: string | null }
  onChange: (value: AttributedCloudinaryAsset[]) => void
  onUpload: (
    file: File,
    signal: AbortSignal,
    onProgress?: (percent: number) => void
  ) => Promise<AttributedCloudinaryAsset>
}

export function FileUploadField({
  questionKey,
  value,
  mode = "single",
  maxFiles = FILE_MAX_FILES,
  maxSizeBytes = DEFAULT_FILE_MAX_SIZE_BYTES,
  uploadState,
  onChange,
  onUpload,
}: FileUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string>("")

  // Slot-based upload state - temporary lifecycle tracking
  const [uploadSlots, setUploadSlots] = useState<FileUploadSlot[]>([])
  const uploadSlotsRef = useRef<FileUploadSlot[]>([])
  const activeUploadsRef = useRef<Map<string, AbortController>>(new Map())
  const lastAnnouncedMilestoneRef = useRef<Map<string, number>>(new Map())

  // Sync ref with state
  useEffect(() => {
    uploadSlotsRef.current = uploadSlots
  }, [uploadSlots])

  // Cleanup on unmount - abort all active uploads
  useEffect(() => {
    return () => {
      activeUploadsRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  // Normalize persisted value to array
  const persistedAssets = (() => {
    if (Array.isArray(value)) return value.filter(isAttributedCloudinaryAsset)
    if (isAttributedCloudinaryAsset(value)) return [value]
    return []
  })()

  // Combined display list: persisted assets + active upload slots
  const displayItems = [
    // Persisted assets (durable)
    ...persistedAssets.map((asset) => ({ type: "persisted" as const, asset })),
    // Upload slots (temporary lifecycle)
    ...uploadSlots.map((slot) => ({ type: "slot" as const, slot })),
  ]

  const totalCount = persistedAssets.length + uploadSlots.length
  const canAddMore = totalCount < maxFiles
  const remainingSlots = maxFiles - totalCount

  // Compute derived uploading state from slots
  const hasUploadingSlots = uploadSlots.some((s) => s.status === "pending")
  const isUploading = uploadState?.isUploading ?? hasUploadingSlots

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!file) {
        return "No file selected"
      }
      if (!file.type) {
        const ext = file.name.split(".").pop()?.toLowerCase()
        if (!ext || !FILE_ACCEPTED_EXTENSIONS.includes(ext as (typeof FILE_ACCEPTED_EXTENSIONS)[number])) {
          return `Unknown file type. Accepted: ${FILE_ACCEPTED_EXTENSIONS.join(", ").toUpperCase()}`
        }
        return null
      }

      const typeOk = FILE_ACCEPTED_TYPES.includes(file.type as (typeof FILE_ACCEPTED_TYPES)[number])
      if (!typeOk) {
        return `Invalid file type. Accepted: ${FILE_ACCEPTED_EXTENSIONS.join(", ").toUpperCase()}`
      }
      if (file.size > maxSizeBytes) {
        const maxMB = (maxSizeBytes / 1024 / 1024).toFixed(0)
        return `File too large. Maximum ${maxMB}MB`
      }
      return null
    },
    [maxSizeBytes]
  )

  const createSlotId = useCallback(() => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, [])

  const uploadSlot = useCallback(
    async (slotId: string, file: File) => {
      console.log("[FileUpload] uploadSlot called:", slotId, file.name)
      const controller = new AbortController()
      activeUploadsRef.current.set(slotId, controller)

      // Initialize milestone tracking for this slot
      lastAnnouncedMilestoneRef.current.set(slotId, 0)

      // Progress handler for this specific slot
      const handleProgress = (percent: number) => {
        setUploadSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, progressPercent: percent } : s)))

        // Announce milestone if crossed
        const milestones = [25, 50, 75, 100]
        const lastMilestone = lastAnnouncedMilestoneRef.current.get(slotId) ?? 0
        for (const milestone of milestones) {
          if (percent >= milestone && lastMilestone < milestone) {
            lastAnnouncedMilestoneRef.current.set(slotId, milestone)
            setAnnouncement(`Upload ${milestone}% complete: ${file.name}`)
            break
          }
        }
      }

      try {
        console.log("[FileUpload] Calling onUpload for:", file.name)
        const asset = await onUpload(file, controller.signal, handleProgress)
        console.log("[FileUpload] onUpload succeeded:", asset.publicId)

        // Check if upload was canceled (slot no longer exists)
        const currentSlots = uploadSlotsRef.current
        if (!currentSlots.find((s) => s.id === slotId)) {
          return
        }

        // Update slot to success
        setUploadSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, status: "success", progressPercent: 100, asset } : s))
        )
        setAnnouncement(`Upload complete: ${asset.originalFilename || file.name}`)

        // Brief delay then promote to persisted value and remove slot
        setTimeout(() => {
          // Add asset to persisted value
          const newAssets = mode === "single" ? [asset] : [...persistedAssets, asset]
          onChange(newAssets)

          // Remove the slot (it's now in persisted state)
          setUploadSlots((prev) => prev.filter((s) => s.id !== slotId))
          activeUploadsRef.current.delete(slotId)
          lastAnnouncedMilestoneRef.current.delete(slotId)
        }, 500)
      } catch (error) {
        console.error("[FileUpload] onUpload failed:", error)
        // Check if slot still exists
        const currentSlots = uploadSlotsRef.current
        if (!currentSlots.find((s) => s.id === slotId)) {
          return
        }

        const message = error instanceof Error ? error.message : "Upload failed"

        if (message === "Upload canceled") {
          setAnnouncement(`Upload canceled: ${file.name}`)
          // Remove canceled slot
          setUploadSlots((prev) => prev.filter((s) => s.id !== slotId))
        } else {
          // Mark slot as error
          setUploadSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "error", error: message } : s)))
          setAnnouncement(`Upload failed: ${file.name} - ${message}`)
        }

        activeUploadsRef.current.delete(slotId)
        lastAnnouncedMilestoneRef.current.delete(slotId)
      }
    },
    [onUpload, onChange, persistedAssets, mode]
  )

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      console.log("[FileUpload] File selected:", files?.length, "files")
      if (!files || files.length === 0) {
        console.log("[FileUpload] No files selected, returning")
        return
      }

      event.target.value = ""

      // Single mode: only process first file
      const filesToProcess = (mode === "single" ? [files[0]] : Array.from(files)).filter((f): f is File => !!f)
      console.log("[FileUpload] Files to process:", filesToProcess.length)

      // Check if we can accept these files
      if (mode === "multiple" && filesToProcess.length > remainingSlots) {
        const acceptedCount = remainingSlots
        const rejectedCount = filesToProcess.length - remainingSlots
        setLocalError(`Only ${acceptedCount} of ${filesToProcess.length} files can be added (max ${maxFiles} files)`)
        if (acceptedCount === 0) return
        filesToProcess.splice(acceptedCount)
      }

      // Validate each file
      const validFiles: File[] = []
      for (const file of filesToProcess) {
        const error = validateFile(file)
        if (error) {
          console.log("[FileUpload] Validation failed:", file.name, error)
          setLocalError(`${file.name}: ${error}`)
          continue
        }
        validFiles.push(file)
      }

      console.log("[FileUpload] Valid files:", validFiles.length)
      if (validFiles.length === 0) return

      setLocalError(null)

      // In single mode with existing persisted file, keep it visible until new upload succeeds
      // (handled by uploadSlot - it only replaces on success)

      // Create slots for each file
      const newSlots: FileUploadSlot[] = validFiles.map((file) => ({
        id: createSlotId(),
        file,
        status: "pending",
        progressPercent: 0,
      }))

      setUploadSlots((prev) => [...prev, ...newSlots])

      // Start uploads
      console.log("[FileUpload] Starting uploads for", newSlots.length, "slots")
      for (const slot of newSlots) {
        console.log("[FileUpload] Starting upload for slot:", slot.id, slot.file.name)
        uploadSlot(slot.id, slot.file)
      }

      setAnnouncement(`Uploading ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}...`)
    },
    [mode, remainingSlots, maxFiles, uploadSlot, validateFile, createSlotId]
  )

  const handleRemovePersisted = useCallback(
    (asset: AttributedCloudinaryAsset) => {
      const newAssets = persistedAssets.filter((a) => a.publicId !== asset.publicId)
      onChange(newAssets)
      setAnnouncement(`File removed: ${asset.originalFilename || "file"}`)
    },
    [persistedAssets, onChange]
  )

  const handleRemoveSlot = useCallback(
    (slotId: string) => {
      const slot = uploadSlots.find((s) => s.id === slotId)
      if (!slot) return

      // Abort if still uploading
      const controller = activeUploadsRef.current.get(slotId)
      if (controller && slot.status === "pending") {
        controller.abort()
      }

      setUploadSlots((prev) => prev.filter((s) => s.id !== slotId))
      activeUploadsRef.current.delete(slotId)
      lastAnnouncedMilestoneRef.current.delete(slotId)
      setAnnouncement(`File removed: ${slot.file.name}`)
    },
    [uploadSlots]
  )

  const handleRetrySlot = useCallback(
    (slotId: string) => {
      const slot = uploadSlots.find((s) => s.id === slotId)
      if (!slot || slot.status !== "error") return

      // Reset slot to pending
      setUploadSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: "pending", progressPercent: 0, error: undefined } : s))
      )

      // Retry upload
      uploadSlot(slotId, slot.file)
      setAnnouncement(`Retrying upload: ${slot.file.name}`)
    },
    [uploadSlots, uploadSlot]
  )

  // Build cumulative aria-describedby
  const hintId = `${questionKey}-hint`
  const errorId = `${questionKey}-error`
  const describedByIds = [hintId]
  const displayError = localError || uploadState?.error
  if (displayError) describedByIds.push(errorId)
  const ariaDescribedBy = describedByIds.join(" ")

  // Determine button text based on mode and state
  const buttonText = (() => {
    if (hasUploadingSlots) return "Uploading..."
    if (mode === "single") {
      return persistedAssets.length > 0 ? "Replace file" : "Upload file"
    }
    // Multiple mode
    if (persistedAssets.length === 0 && uploadSlots.length === 0) return "Upload files"
    return "Add more files"
  })()

  return (
    <div className="space-y-3">
      {/* aria-live announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <input
        ref={fileInputRef}
        id={`${questionKey}-file-input`}
        type="file"
        className="sr-only"
        onChange={handleFileSelect}
        accept={FILE_ACCEPTED_TYPES.join(",")}
        multiple={mode === "multiple"}
        aria-label={buttonText}
        aria-describedby={ariaDescribedBy}
        aria-invalid={!!displayError}
        disabled={!canAddMore || hasUploadingSlots}
      />

      <div className="flex flex-col gap-3">
        {/* File count summary in multiple mode */}
        {mode === "multiple" && (
          <p className="text-muted-foreground text-sm">
            {totalCount} of {maxFiles} files
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            if (!fileInputRef.current) {
              console.error("File input ref is null")
              return
            }
            fileInputRef.current.click()
          }}
          disabled={!canAddMore || hasUploadingSlots}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            !canAddMore || hasUploadingSlots
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <Upload className="h-4 w-4" />
          <span>{buttonText}</span>
        </button>

        <div id={hintId} className="text-muted-foreground space-y-1 text-xs">
          <p>
            {FILE_ACCEPTED_EXTENSIONS.join(", ").toUpperCase()} up to {(maxSizeBytes / 1024 / 1024).toFixed(0)}MB
          </p>
          {mode === "multiple" && !canAddMore && <p className="text-amber-600">Maximum {maxFiles} files allowed</p>}
        </div>
      </div>

      {displayError && (
        <p id={errorId} className="text-destructive text-sm">
          {displayError}
        </p>
      )}

      {/* File list - persisted assets + upload slots */}
      {displayItems.length > 0 && (
        <div className="space-y-2">
          {/* Persisted files */}
          {persistedAssets.map((asset) => (
            <div key={asset.publicId} className="rounded-md border p-3">
              <div className="flex items-start gap-3">
                <FileText className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={asset.secureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary block truncate text-sm hover:underline"
                  >
                    {asset.originalFilename || asset.publicId || "Uploaded file"}
                  </a>
                  {asset.bytes ? (
                    <p className="text-muted-foreground text-xs">{(asset.bytes / 1024 / 1024).toFixed(2)} MB</p>
                  ) : null}
                  {/* Attribution display */}
                  {asset.uploadedByDisplayName ? (
                    <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                      <p>Uploaded by {asset.uploadedByDisplayName}</p>
                      {asset.uploadedAt ? <p>{formatUploadTimestamp(asset.uploadedAt)}</p> : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs disabled:opacity-50"
                  onClick={() => handleRemovePersisted(asset)}
                  aria-label={`Remove ${asset.originalFilename || "file"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Upload slots (in-flight or error) */}
          {uploadSlots.map((slot) => (
            <div
              key={slot.id}
              className={cn(
                "rounded-md border p-3",
                slot.status === "error" && "border-destructive/50 bg-destructive/5"
              )}
            >
              <div className="flex items-start gap-3">
                <FileText className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{slot.file.name}</p>
                  <p className="text-muted-foreground text-xs">{(slot.file.size / 1024 / 1024).toFixed(2)} MB</p>

                  {/* Progress bar for pending uploads */}
                  {slot.status === "pending" && (
                    <div className="mt-2 space-y-1">
                      <div
                        role="progressbar"
                        aria-valuenow={slot.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Upload progress for ${slot.file.name}`}
                        className="bg-muted h-2 w-full overflow-hidden rounded-full"
                      >
                        <div
                          className="bg-primary h-full transition-all duration-150 ease-out"
                          style={{ width: `${slot.progressPercent}%` }}
                        />
                      </div>
                      <p className="text-muted-foreground text-right text-xs">{slot.progressPercent}%</p>
                    </div>
                  )}

                  {/* Success indicator (briefly shown before removal) */}
                  {slot.status === "success" && (
                    <p className="text-muted-foreground mt-1 text-xs">Complete - processing...</p>
                  )}

                  {/* Error state */}
                  {slot.status === "error" && slot.error && (
                    <p className="text-destructive mt-1 text-xs">{slot.error}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Retry button for error state */}
                  {slot.status === "error" && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => handleRetrySlot(slot.id)}
                      aria-label={`Retry upload for ${slot.file.name}`}
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => handleRemoveSlot(slot.id)}
                    aria-label={
                      slot.status === "pending" ? `Cancel upload for ${slot.file.name}` : `Remove ${slot.file.name}`
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
