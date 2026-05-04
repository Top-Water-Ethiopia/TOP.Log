"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { CustomQuestion } from "@/lib/rbac/types"
import { getQuestionReactKey } from "@/lib/role-question-identity"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import type { CloudinaryResourceType, CloudinaryUploadAsset } from "@/lib/cloudinary"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Upload } from "lucide-react"
import {
  getImageUploadMode,
  normalizeImageResponseValue,
  IMAGE_ACCEPTED_TYPES,
  IMAGE_MAX_FILES,
  type AttributedCloudinaryAsset,
  type ImageUploadMode,
  getImageMaxSizeBytes,
} from "@/lib/image-upload"
import { getFileUploadMode, FILE_MAX_FILES } from "@/lib/upload-config"
import { getFileMaxSizeBytes } from "@/lib/upload-types"
import { FileUploadField } from "@/components/file-upload-field"

type UploadState = {
  isUploading: boolean
  error: string | null
}

type QuestionOption = string | { value: string; label: string }

function normalizeQuestionOption(option: QuestionOption): { value: string; label: string } | null {
  if (typeof option === "string") {
    const trimmed = option.trim()
    return trimmed ? { value: trimmed, label: trimmed } : null
  }

  if (!option || typeof option !== "object") return null
  const value = typeof option.value === "string" ? option.value.trim() : ""
  if (!value) return null
  const label = typeof option.label === "string" ? option.label.trim() : ""
  return { value, label: label || value }
}

type ImageUploadSlot = {
  id: string
  status: "pending" | "success" | "error"
  progressPercent: number
  previewUrl?: string
  asset?: AttributedCloudinaryAsset
  error?: string
}

type FileUploadSlot = {
  id: string
  file: File
  status: "pending" | "success" | "error"
  progressPercent: number
  asset?: AttributedCloudinaryAsset
  error?: string
}

type SignedUploadResponse = {
  data: {
    cloudName: string
    apiKey: string
    folder: string
    timestamp: number
    signature: string
    resourceType: CloudinaryResourceType
  }
}

type CloudinaryUploadResponse = {
  public_id: string
  secure_url: string
  original_filename?: string
  bytes?: number
  format?: string
  resource_type?: string
}

function isCloudinaryAsset(value: unknown): value is CloudinaryUploadAsset {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<CloudinaryUploadAsset>
  return candidate.provider === "cloudinary" && typeof candidate.secureUrl === "string"
}

interface RoleBasedQuestionFieldsProps {
  questions: (
    | CustomQuestion
    | {
        id?: string
        key: string
        label: string
        type: string
        description?: string
        placeholder?: string
        options?: any
        required: boolean
        order: number
        category?: string
        validationRules?: any
        validation?: any
        defaultValue?: any
      }
  )[]
  responses: Record<string, any>
  errors?: Record<string, string>
  onChange: (questionKey: string, value: any) => void
  onUploadPendingStateChange?: (questionKey: string, hasBlockingUploads: boolean) => void
  renderMode?: "full" | "fieldsOnly" | "grouped"
}

export function RoleBasedQuestionFields({
  questions,
  responses,
  errors = {},
  onChange,
  onUploadPendingStateChange,
  renderMode = "full",
}: RoleBasedQuestionFieldsProps) {
  const { user, profile } = useSupabaseAuth()
  const hasQuestions = questions.length > 0
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({})
  const [imageUploadSlots, setImageUploadSlots] = useState<Record<string, ImageUploadSlot[]>>({})
  const [fileUploadSlots, setFileUploadSlots] = useState<Record<string, FileUploadSlot[]>>({})
  const [imageDragStates, setImageDragStates] = useState<Record<string, boolean>>({})
  const [imageAnnouncements, setImageAnnouncements] = useState<Record<string, string>>({})
  const activeImageUploadsRef = useRef<Record<string, XMLHttpRequest>>({})
  const imageUploadSlotsRef = useRef<Record<string, ImageUploadSlot[]>>({})
  const fileUploadSlotsRef = useRef<Record<string, FileUploadSlot[]>>({})
  const imageBlockingStateRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    imageUploadSlotsRef.current = imageUploadSlots
  }, [imageUploadSlots])

  useEffect(() => {
    fileUploadSlotsRef.current = fileUploadSlots
  }, [fileUploadSlots])

  useEffect(() => {
    return () => {
      Object.values(activeImageUploadsRef.current).forEach((request) => request.abort())
      setImageUploadSlots((prev) => {
        Object.values(prev)
          .flat()
          .forEach((slot) => {
            if (slot.previewUrl) {
              URL.revokeObjectURL(slot.previewUrl)
            }
          })
        return prev
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!onUploadPendingStateChange) {
      return
    }

    const imageQuestionKeys = questions
      .filter((question) => question.type === "image")
      .map((question) => String(question.key))

    Object.keys(imageBlockingStateRef.current).forEach((questionKey) => {
      if (imageQuestionKeys.includes(questionKey)) {
        return
      }

      if (imageBlockingStateRef.current[questionKey] !== false) {
        onUploadPendingStateChange(questionKey, false)
      }
      delete imageBlockingStateRef.current[questionKey]
    })

    imageQuestionKeys.forEach((questionKey) => {
      const slots = imageUploadSlots[questionKey] || []
      const hasBlockingUploads = slots.some((slot) => slot.status !== "success" && slot.status !== "error")

      if (imageBlockingStateRef.current[questionKey] === hasBlockingUploads) {
        return
      }

      imageBlockingStateRef.current[questionKey] = hasBlockingUploads
      onUploadPendingStateChange(questionKey, hasBlockingUploads)
    })
  }, [imageUploadSlots, onUploadPendingStateChange, questions])

  useEffect(() => {
    return () => {
      if (!onUploadPendingStateChange) {
        return
      }

      Object.keys(imageBlockingStateRef.current).forEach((questionKey) => {
        onUploadPendingStateChange(questionKey, false)
      })
      imageBlockingStateRef.current = {}
    }
  }, [onUploadPendingStateChange])

  const updateUploadState = useCallback((questionKey: string, next: Partial<UploadState>) => {
    setUploadStates((prev) => ({
      ...prev,
      [questionKey]: {
        isUploading: next.isUploading ?? prev[questionKey]?.isUploading ?? false,
        error: Object.prototype.hasOwnProperty.call(next, "error")
          ? (next.error ?? null)
          : (prev[questionKey]?.error ?? null),
      },
    }))
  }, [])

  const getUploaderDisplayName = useCallback(() => {
    if (typeof profile?.name === "string" && profile.name.trim().length > 0) return profile.name.trim()
    if (typeof user?.email === "string" && user.email.trim().length > 0) return user.email.trim()
    return "Unknown User"
  }, [profile?.name, user?.email])

  const uploadAsset = useCallback(
    async (
      questionKey: string,
      questionType: "file" | "image",
      file: File,
      signal?: AbortSignal,
      onProgress?: (percent: number) => void
    ): Promise<AttributedCloudinaryAsset> => {
      console.log("[uploadAsset] Starting upload:", questionKey, questionType, file.name)
      updateUploadState(questionKey, { isUploading: true, error: null })

      try {
        console.log("[uploadAsset] Fetching signature...")
        const signaturePayload = await apiFetch<SignedUploadResponse>("/api/uploads/cloudinary/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resourceType: questionType === "image" ? "image" : "raw",
          }),
        })
        console.log("[uploadAsset] Got signature:", signaturePayload.data.cloudName)

        const signed = signaturePayload.data
        const formData = new FormData()
        formData.append("file", file)
        formData.append("api_key", signed.apiKey)
        formData.append("timestamp", String(signed.timestamp))
        formData.append("signature", signed.signature)
        formData.append("folder", signed.folder)

        // Use XMLHttpRequest for progress tracking
        console.log("[uploadAsset] Starting XHR upload to Cloudinary...")
        const asset = await new Promise<AttributedCloudinaryAsset>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          let lastEmittedPercent = -1

          // Track upload progress
          xhr.upload.onprogress = (event) => {
            if (!onProgress) return
            if (!event.lengthComputable || event.total <= 0) return

            const percent = Math.round((event.loaded / event.total) * 100)
            // Throttle: only emit when percentage changes
            if (percent !== lastEmittedPercent) {
              lastEmittedPercent = percent
              onProgress(Math.min(100, Math.max(0, percent)))
            }
          }

          // Handle abort signal
          const abortHandler = () => {
            xhr.abort()
          }
          signal?.addEventListener("abort", abortHandler)

          xhr.onload = () => {
            signal?.removeEventListener("abort", abortHandler)
            console.log("[uploadAsset] XHR onload:", xhr.status)

            if (signal?.aborted) {
              reject(new Error("Upload canceled"))
              return
            }

            if (xhr.status < 200 || xhr.status >= 300) {
              console.error("[uploadAsset] XHR failed with status:", xhr.status, xhr.responseText)
              reject(new Error("Upload failed"))
              return
            }

            let uploaded: CloudinaryUploadResponse | null = null
            try {
              uploaded = JSON.parse(xhr.responseText) as CloudinaryUploadResponse
            } catch {
              reject(new Error("Upload failed"))
              return
            }

            if (!uploaded?.secure_url || !uploaded.public_id) {
              reject(new Error("Upload failed"))
              return
            }

            const result: AttributedCloudinaryAsset = {
              provider: "cloudinary",
              resourceType: signed.resourceType,
              publicId: uploaded.public_id,
              secureUrl: uploaded.secure_url,
              originalFilename: uploaded.original_filename || file.name,
              bytes: uploaded.bytes ?? file.size,
              format: uploaded.format ?? null,
              uploadedByUserId: user?.id,
              uploadedByDisplayName: getUploaderDisplayName(),
              uploadedAt: new Date().toISOString(),
            }
            resolve(result)
          }

          xhr.onerror = () => {
            signal?.removeEventListener("abort", abortHandler)
            console.error("[uploadAsset] XHR onerror")
            reject(new Error("Upload failed"))
          }

          xhr.onabort = () => {
            signal?.removeEventListener("abort", abortHandler)
            console.log("[uploadAsset] XHR onabort")
            reject(new Error("Upload canceled"))
          }

          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${signed.resourceType}/upload`
          )
          xhr.send(formData)
        })

        return asset
      } catch (error) {
        console.error("[uploadAsset] Error:", error)
        if (error instanceof Error && error.name === "AbortError") {
          updateUploadState(questionKey, { error: null })
          throw new Error("Upload canceled")
        }
        const message = error instanceof Error ? error.message : "Upload failed"
        updateUploadState(questionKey, { error: message })
        throw error
      } finally {
        updateUploadState(questionKey, { isUploading: false })
      }
    },
    [updateUploadState, user?.id, getUploaderDisplayName]
  )

  const syncImageResponse = useCallback(
    (questionKey: string, slots: ImageUploadSlot[]) => {
      onChange(
        questionKey,
        slots
          .filter((slot) => slot.status === "success" && slot.asset)
          .map((slot) => slot.asset as AttributedCloudinaryAsset)
      )
    },
    [onChange]
  )

  const updateImageSlots = useCallback(
    (questionKey: string, updater: (currentSlots: ImageUploadSlot[]) => ImageUploadSlot[]) => {
      const currentSlots = imageUploadSlotsRef.current[questionKey] || []
      const nextSlots = updater(currentSlots)
      imageUploadSlotsRef.current = {
        ...imageUploadSlotsRef.current,
        [questionKey]: nextSlots,
      }
      setImageUploadSlots((prev) => ({
        ...prev,
        [questionKey]: nextSlots,
      }))
      return nextSlots
    },
    []
  )

  const updateFileSlots = useCallback(
    (questionKey: string, updater: (currentSlots: FileUploadSlot[]) => FileUploadSlot[]) => {
      const currentSlots = fileUploadSlotsRef.current[questionKey] || []
      const nextSlots = updater(currentSlots)
      fileUploadSlotsRef.current = {
        ...fileUploadSlotsRef.current,
        [questionKey]: nextSlots,
      }
      setFileUploadSlots((prev) => ({
        ...prev,
        [questionKey]: nextSlots,
      }))
      return nextSlots
    },
    []
  )

  const uploadImageSlot = useCallback(
    async (questionKey: string, slotId: string, file: File) => {
      try {
        const signaturePayload = await apiFetch<SignedUploadResponse>("/api/uploads/cloudinary/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resourceType: "image",
          }),
        })

        const signed = signaturePayload.data
        const formData = new FormData()
        formData.append("file", file)
        formData.append("api_key", signed.apiKey)
        formData.append("timestamp", String(signed.timestamp))
        formData.append("signature", signed.signature)
        formData.append("folder", signed.folder)

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          activeImageUploadsRef.current[slotId] = xhr

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return
            const nextProgress = Math.min(99, Math.round((event.loaded / event.total) * 100))
            updateImageSlots(questionKey, (currentSlots) =>
              currentSlots.map((slot) => (slot.id === slotId ? { ...slot, progressPercent: nextProgress } : slot))
            )
          }

          xhr.onerror = () => reject(new Error("Upload failed"))
          xhr.onabort = () => reject(new Error("Upload canceled"))
          xhr.onload = () => {
            const uploaded = JSON.parse(xhr.responseText || "null") as CloudinaryUploadResponse | null
            if (xhr.status < 200 || xhr.status >= 300 || !uploaded?.secure_url || !uploaded.public_id) {
              reject(new Error("Upload failed"))
              return
            }

            const asset: AttributedCloudinaryAsset = {
              provider: "cloudinary",
              resourceType: signed.resourceType,
              publicId: uploaded.public_id,
              secureUrl: uploaded.secure_url,
              originalFilename: uploaded.original_filename || file.name,
              bytes: uploaded.bytes ?? file.size,
              format: uploaded.format ?? null,
              uploadedByUserId: user?.id,
              uploadedByDisplayName: getUploaderDisplayName(),
              uploadedAt: new Date().toISOString(),
            }

            const nextSlots = updateImageSlots(questionKey, (currentSlots) =>
              currentSlots.map((slot) =>
                slot.id === slotId
                  ? {
                      ...slot,
                      status: "success" as const,
                      progressPercent: 100,
                      asset,
                      error: undefined,
                    }
                  : slot
              )
            )
            syncImageResponse(questionKey, nextSlots)

            resolve()
          }

          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${signed.resourceType}/upload`
          )
          xhr.send(formData)
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed"

        if (message === "Upload canceled") {
          delete activeImageUploadsRef.current[slotId]
          return
        }

        updateImageSlots(questionKey, (currentSlots) =>
          currentSlots.map((slot) =>
            slot.id === slotId ? { ...slot, status: "error", error: message, progressPercent: 0 } : slot
          )
        )
      } finally {
        delete activeImageUploadsRef.current[slotId]
      }
    },
    [getUploaderDisplayName, syncImageResponse, updateImageSlots, user?.id]
  )

  const removeImageSlot = useCallback(
    (questionKey: string, slotId: string) => {
      const request = activeImageUploadsRef.current[slotId]
      if (request) {
        request.abort()
        delete activeImageUploadsRef.current[slotId]
      }

      const nextSlots = updateImageSlots(questionKey, (currentSlots) => {
        const removedSlot = currentSlots.find((slot) => slot.id === slotId)
        if (removedSlot?.previewUrl) {
          URL.revokeObjectURL(removedSlot.previewUrl)
        }

        return currentSlots.filter((slot) => slot.id !== slotId)
      })
      syncImageResponse(questionKey, nextSlots)
    },
    [syncImageResponse, updateImageSlots]
  )

  const queueImageUploads = useCallback(
    async (question: any, files: FileList | File[]) => {
      const selectedFiles = Array.from(files)
      const questionKey = question.key
      const uploadMode =
        (question.imageUploadMode as ImageUploadMode | undefined) || getImageUploadMode(question.metadata)

      const existingSlots = imageUploadSlots[questionKey] || []
      const currentAssets = normalizeImageResponseValue(responses[questionKey])
      const currentCount = uploadMode === "single" ? 0 : Math.max(existingSlots.length, currentAssets.length)
      const maxAdditional = Math.max(0, 20 - currentCount)

      if (selectedFiles.length > maxAdditional && uploadMode === "multiple") {
        updateUploadState(questionKey, {
          error:
            maxAdditional === 0
              ? "You can upload up to 20 images for this question."
              : `Only ${maxAdditional} more image(s) can be uploaded.`,
        })
      } else {
        updateUploadState(questionKey, { error: null })
      }

      const allowedFiles =
        uploadMode === "single" ? selectedFiles.slice(0, 1) : selectedFiles.slice(0, Math.max(0, maxAdditional))
      if (allowedFiles.length === 0) return

      if (uploadMode === "single") {
        existingSlots.forEach((slot) => {
          if (slot.previewUrl) {
            URL.revokeObjectURL(slot.previewUrl)
          }
          const request = activeImageUploadsRef.current[slot.id]
          if (request) {
            request.abort()
            delete activeImageUploadsRef.current[slot.id]
          }
        })
      }

      const nextSlots = allowedFiles.map((file) => ({
        id: `${questionKey}-${Date.now()}-${Math.random()}`,
        status: "pending" as const,
        progressPercent: 0,
        previewUrl: URL.createObjectURL(file),
      }))

      updateImageSlots(questionKey, (currentSlots) =>
        uploadMode === "single" ? nextSlots : [...currentSlots, ...nextSlots]
      )

      syncImageResponse(questionKey, uploadMode === "single" ? [] : existingSlots)

      await Promise.all(nextSlots.map((slot, index) => uploadImageSlot(questionKey, slot.id, allowedFiles[index]!)))
    },
    [imageUploadSlots, responses, syncImageResponse, updateImageSlots, updateUploadState, uploadImageSlot]
  )

  const renderField = (question: any, value: any, error?: string) => {
    const validationRules = (question?.validationRules || question?.validation || {}) as any
    const uploadState = uploadStates[question.key]
    const imageUploadMode =
      (question.imageUploadMode as ImageUploadMode | undefined) || getImageUploadMode(question.metadata)
    const normalizedImageAssets = question.type === "image" ? normalizeImageResponseValue(value) : []
    const slots = question.type === "image" ? imageUploadSlots[question.key] || [] : []

    const ariaInvalid = !!error
    const ariaDescribedBy = error ? `${question.key}-error` : undefined

    switch (question.type) {
      case "text":
        return (
          <Input
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "textarea":
        return (
          <Textarea
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn("min-h-[200px]", error ? "border-destructive" : "")}
            rows={4}
          />
        )

      case "email":
        return (
          <Input
            id={question.key}
            type="email"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "name@example.com"}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "url":
        return (
          <Input
            id={question.key}
            type="url"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "https://example.com"}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "phone":
        return (
          <Input
            id={question.key}
            type="tel"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "+251 901-234-567"}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "number":
        return (
          <div className="relative">
            <Input
              id={question.key}
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={error ? "border-destructive" : ""}
            />
          </div>
        )

      case "currency":
        return (
          <div className="relative">
            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">$</span>
            <Input
              id={question.key}
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder || "0.00"}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step ?? "0.01"}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={`pl-7 ${error ? "border-destructive" : ""}`}
            />
          </div>
        )

      case "percentage":
        return (
          <div className="relative">
            <Input
              id={question.key}
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder || "0"}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={`pr-7 ${error ? "border-destructive" : ""}`}
            />
            <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2">%</span>
          </div>
        )

      case "date":
        return (
          <Input
            id={question.key}
            type="date"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            min={validationRules?.min_date}
            max={validationRules?.max_date}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "time":
        return (
          <Input
            id={question.key}
            type="time"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "datetime":
        return (
          <Input
            id={question.key}
            type="datetime-local"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            min={validationRules?.min_date}
            max={validationRules?.max_date}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "daterange":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Start Date</Label>
              <Input
                type="date"
                value={value?.start ?? ""}
                onChange={(event) => onChange(question.key, { ...value, start: event.target.value })}
                min={validationRules?.min_date}
                max={value?.end || validationRules?.max_date}
                className={error ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">End Date</Label>
              <Input
                type="date"
                value={value?.end ?? ""}
                onChange={(event) => onChange(question.key, { ...value, end: event.target.value })}
                min={value?.start || validationRules?.min_date}
                max={validationRules?.max_date}
                className={error ? "border-destructive" : ""}
              />
            </div>
          </div>
        )

      case "duration":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Hours</Label>
              <Input
                type="number"
                value={value?.hours ?? ""}
                onChange={(event) => onChange(question.key, { ...value, hours: event.target.value })}
                placeholder="0"
                min="0"
                className={error ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Minutes</Label>
              <Input
                type="number"
                value={value?.minutes ?? ""}
                onChange={(event) => onChange(question.key, { ...value, minutes: event.target.value })}
                placeholder="0"
                min="0"
                max="59"
                className={error ? "border-destructive" : ""}
              />
            </div>
          </div>
        )

      case "select":
      case "priority":
      case "status":
        return (
          <Select value={value ?? ""} onValueChange={(newValue) => onChange(question.key, newValue)}>
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder={question.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {question.options
                ?.map((option: QuestionOption) => normalizeQuestionOption(option))
                .filter((option): option is { value: string; label: string } => option !== null)
                .map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )

      case "radio":
        return (
          <div className="space-y-2">
            {question.options
              ?.map((option: QuestionOption) => normalizeQuestionOption(option))
              .filter((option): option is { value: string; label: string } => option !== null)
              .map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${question.key}-${option.value}`}
                  name={question.key}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(event) => onChange(question.key, event.target.value)}
                  className="text-primary focus:ring-primary h-4 w-4 border-gray-300 focus:ring-2"
                />
                <Label htmlFor={`${question.key}-${option.value}`} className="cursor-pointer text-sm font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        )

      case "multiselect":
      case "tags":
        return (
          <div className="space-y-2">
            {question.options
              ?.map((option: QuestionOption) => normalizeQuestionOption(option))
              .filter((option): option is { value: string; label: string } => option !== null)
              .map((option) => {
              const currentValues = Array.isArray(value) ? value : []
              const checkboxId = `${question.key}-${option.value}`

              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={checkboxId}
                    checked={currentValues.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onChange(question.key, [...currentValues, option.value])
                      } else {
                        onChange(
                          question.key,
                          currentValues.filter((item: string) => item !== option.value)
                        )
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal">
                    {option.label}
                  </Label>
                </div>
              )
            })}
          </div>
        )

      case "checkbox":
        if (Array.isArray(question.options) && question.options.length > 0) {
          const currentValues = Array.isArray(value) ? value : []

          return (
            <div className="space-y-2">
              {question.options.map((option: string) => {
                const checkboxId = `${question.key}-${option}`

                return (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={checkboxId}
                      checked={currentValues.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange(question.key, [...currentValues, option])
                        } else {
                          onChange(
                            question.key,
                            currentValues.filter((item: string) => item !== option)
                          )
                        }
                      }}
                    />
                    <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal">
                      {option}
                    </Label>
                  </div>
                )
              })}
            </div>
          )
        }

        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={question.key}
              checked={!!value}
              onCheckedChange={(checked) => onChange(question.key, !!checked)}
            />
            <Label htmlFor={question.key} className="cursor-pointer text-sm font-normal">
              {question.placeholder || "Check this option"}
            </Label>
          </div>
        )

      case "rating":
        return (
          <Select value={value ?? ""} onValueChange={(newValue) => onChange(question.key, newValue)}>
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder="Select rating" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "slider":
        return (
          <div className="space-y-4">
            <input
              type="range"
              value={value ?? validationRules?.min_value ?? validationRules?.min ?? 0}
              onChange={(event) => onChange(question.key, event.target.value)}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {validationRules?.min_value ?? validationRules?.min ?? ""}
              </span>
              <span className="text-primary text-lg font-semibold">
                {value ?? validationRules?.min_value ?? validationRules?.min ?? 0}
              </span>
              <span className="text-muted-foreground text-sm">
                {validationRules?.max_value ?? validationRules?.max ?? ""}
              </span>
            </div>
          </div>
        )

      case "nps":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-11 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => onChange(question.key, score)}
                  className={`h-12 rounded-md border-2 font-semibold transition-all ${
                    value === score
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/50 hover:bg-primary/10 border-gray-300"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
          </div>
        )

      case "file": {
        const fileUploadMode = getFileUploadMode(question.metadata)
        const fileMaxSizeBytes = getFileMaxSizeBytes(question.metadata)
        return (
          <FileUploadField
            questionKey={question.key}
            value={value}
            mode={fileUploadMode}
            maxFiles={FILE_MAX_FILES}
            maxSizeBytes={fileMaxSizeBytes}
            uploadState={uploadStates[question.key]}
            onChange={(assets) => onChange(question.key, assets)}
            onUpload={(file, signal, onProgress) => uploadAsset(question.key, "file", file, signal, onProgress)}
          />
        )
      }

      case "image":
        const totalImages = slots.length + normalizedImageAssets.length
        const maxReached = totalImages >= IMAGE_MAX_FILES
        const isDragging = !!imageDragStates[question.key]
        const announcement = imageAnnouncements[question.key] || ""
        const imageMaxSizeBytes = getImageMaxSizeBytes(question.metadata)

        const handleDragOver = (e: React.DragEvent) => {
          e.preventDefault()
          if (maxReached) return
          setImageDragStates((prev) => ({ ...prev, [question.key]: true }))
        }

        const handleDragLeave = (e: React.DragEvent) => {
          e.preventDefault()
          setImageDragStates((prev) => ({ ...prev, [question.key]: false }))
        }

        const validateAndFilterFiles = (files: FileList | File[]) => {
          const fileArray = Array.from(files)
          const validFiles: File[] = []
          const invalidReasons: string[] = []

          for (const file of fileArray) {
            const typeOk = IMAGE_ACCEPTED_TYPES.includes(file.type as (typeof IMAGE_ACCEPTED_TYPES)[number])
            const sizeOk = file.size <= imageMaxSizeBytes

            if (!typeOk) {
              invalidReasons.push(`${file.name}: invalid type`)
            } else if (!sizeOk) {
              const maxMB = (imageMaxSizeBytes / 1024 / 1024).toFixed(0)
              invalidReasons.push(`${file.name}: exceeds ${maxMB}MB`)
            } else {
              validFiles.push(file)
            }
          }

          return { validFiles, invalidCount: invalidReasons.length }
        }

        const processFiles = async (files: FileList | File[]) => {
          const { validFiles, invalidCount } = validateAndFilterFiles(files)

          // Report validation errors
          if (invalidCount > 0) {
            updateUploadState(question.key, {
              error: `${invalidCount} file(s) skipped (invalid type or too large)`,
            })
          }

          if (validFiles.length === 0) return

          // Check max files constraint
          const remainingSlots = IMAGE_MAX_FILES - totalImages
          const filesToUpload = validFiles.slice(0, remainingSlots)
          const excessCount = validFiles.length - filesToUpload.length

          if (excessCount > 0) {
            updateUploadState(question.key, {
              error: `Only ${filesToUpload.length} of ${validFiles.length} files can be uploaded (max ${IMAGE_MAX_FILES} images)`,
            })
          }

          if (filesToUpload.length > 0) {
            setImageAnnouncements((prev) => ({
              ...prev,
              [question.key]: `${filesToUpload.length} image${filesToUpload.length === 1 ? "" : "s"} uploading`,
            }))
            await queueImageUploads(question, filesToUpload)
            setImageAnnouncements((prev) => ({
              ...prev,
              [question.key]: `Upload complete. ${totalImages + filesToUpload.length} total images.`,
            }))
          }
        }

        const handleDrop = async (e: React.DragEvent) => {
          e.preventDefault()
          setImageDragStates((prev) => ({ ...prev, [question.key]: false }))
          if (maxReached) return
          const files = e.dataTransfer.files
          if (files?.length) {
            await processFiles(files)
          }
        }

        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
          const files = event.target.files
          if (files?.length) {
            await processFiles(files)
            // Reset input to allow same-file reselection
            event.target.value = ""
          }
        }

        // Build cumulative aria-describedby (hint + error)
        const hintId = `${question.key}-hint`
        const errorId = `${question.key}-error`
        const describedByIds = [hintId]
        if (error) describedByIds.push(errorId)
        const ariaDescribedByIds = describedByIds.join(" ")

        return (
          <div className="space-y-3">
            {/* Screen reader announcement region */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {announcement}
            </div>

            {/* Upload Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative rounded-lg border-2 border-dashed transition-all duration-200",
                isDragging && !maxReached
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
                error && "border-destructive",
                maxReached && "opacity-60"
              )}
            >
              {/* sr-only Native Input */}
              <input
                id={`${question.key}-file-input`}
                type="file"
                className="sr-only"
                multiple={imageUploadMode === "multiple"}
                onChange={handleFileSelect}
                accept={IMAGE_ACCEPTED_TYPES.join(",")}
                aria-label={imageUploadMode === "multiple" ? "Upload multiple images" : "Upload an image"}
                aria-describedby={ariaDescribedByIds}
                aria-invalid={!!error}
                disabled={maxReached}
              />

              {/* Visible Upload Button Area */}
              <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                <button
                  type="button"
                  onClick={() => document.getElementById(`${question.key}-file-input`)?.click()}
                  disabled={maxReached}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    maxReached
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  <span>{imageUploadMode === "multiple" ? "Upload images" : "Upload image"}</span>
                </button>

                <div id={hintId} className="space-y-1">
                  <p className="text-muted-foreground text-xs">Drag and drop or click to browse</p>
                  <p className="text-muted-foreground/70 text-xs">
                    JPG, PNG, GIF, WebP up to {(imageMaxSizeBytes / 1024 / 1024).toFixed(0)}MB
                  </p>
                </div>

                {totalImages > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {totalImages} {totalImages === 1 ? "image" : "images"} selected
                  </p>
                )}

                {maxReached && (
                  <p className="text-muted-foreground text-xs">Maximum {IMAGE_MAX_FILES} images reached</p>
                )}
              </div>
            </div>

            {uploadState?.error ? (
              <p id={errorId} className="text-destructive text-sm">
                {uploadState.error}
              </p>
            ) : null}
            {slots.length > 0 ? (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <div key={slot.id} className="rounded-md border p-3">
                    <div className="flex items-start gap-3">
                      {slot.previewUrl || slot.asset?.secureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slot.previewUrl || slot.asset?.secureUrl}
                          alt={slot.asset?.originalFilename || "Uploading image"}
                          className="h-20 w-20 rounded-md border object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {slot.asset?.originalFilename || slot.error || "Uploading image"}
                        </p>
                        {slot.status === "pending" || slot.status === "success" ? (
                          <p className="text-muted-foreground text-xs">{slot.progressPercent}% uploaded</p>
                        ) : null}
                        {slot.status === "error" ? (
                          <p className="text-destructive text-xs">{slot.error || "Upload failed"}</p>
                        ) : null}
                        {slot.asset?.uploadedByDisplayName ? (
                          <p className="text-muted-foreground text-xs">
                            Uploaded by {slot.asset.uploadedByDisplayName}
                            {slot.asset.uploadedAt ? ` at ${new Date(slot.asset.uploadedAt).toLocaleString()}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={() => removeImageSlot(question.key, slot.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : normalizedImageAssets.length > 0 ? (
              <div className="space-y-2">
                {normalizedImageAssets.map((assetItem, assetIndex) => (
                  <div key={assetItem.publicId} className="rounded-md border p-3">
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={assetItem.secureUrl}
                        alt={assetItem.originalFilename}
                        className="h-20 w-20 rounded-md border object-cover"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <a
                          href={assetItem.secureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary block truncate text-sm hover:underline"
                        >
                          {assetItem.originalFilename}
                        </a>
                        {assetItem.uploadedByDisplayName ? (
                          <p className="text-muted-foreground text-xs">
                            Uploaded by {assetItem.uploadedByDisplayName}
                            {assetItem.uploadedAt ? ` at ${new Date(assetItem.uploadedAt).toLocaleString()}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={() => {
                          onChange(
                            question.key,
                            normalizedImageAssets.filter((_, index) => index !== assetIndex)
                          )
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )

      case "rich-text":
        return (
          <Textarea
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "Enter formatted text..."}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
            rows={6}
          />
        )

      default:
        return (
          <Input
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )
    }
  }

  if (!hasQuestions) {
    return null
  }

  if (renderMode === "grouped") {
    const groups = (() => {
      type Group = { sectionLabel: string | null; questions: RoleBasedQuestionFieldsProps["questions"] }
      const result: Group[] = []
      const byLabelIndex = new Map<string, number>()

      questions.forEach((question) => {
        const sectionLabel = ((question as any).metadata?.section_label as string | undefined) || null

        if (!sectionLabel) {
          result.push({ sectionLabel: null, questions: [question] })
          return
        }

        const existingIndex = byLabelIndex.get(sectionLabel)
        if (existingIndex === undefined) {
          byLabelIndex.set(sectionLabel, result.length)
          result.push({ sectionLabel, questions: [question] })
          return
        }

        result[existingIndex].questions.push(question)
      })

      return result
    })()

    return (
      <div className="space-y-8">
        {groups.map((group, groupIndex) => (
          <div key={`${group.sectionLabel ?? "no-section"}-${groupIndex}`} className="space-y-6">
            {group.sectionLabel ? (
              <div className="mb-2 border-b-2 border-primary/10 pb-2">
                <h2 className="text-lg font-bold text-primary">{group.sectionLabel}</h2>
              </div>
            ) : null}

            {group.questions.map((question, index) => {
              const reactKey = getQuestionReactKey(question, index)
              const value = responses[question.key]
              const error = errors[question.key]

              return (
                <div key={reactKey} className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                      <Badge variant={question.category === "department_report" ? "default" : "secondary"}>
                        {question.category === "department_report" ? "Department Question" : "Profession Question"}
                      </Badge>
                      <h3 className="text-sm font-medium">{question.label}</h3>
                      {question.required ? (
                        <span className="text-muted-foreground text-xs">Required field</span>
                      ) : null}
                    </div>
                    {question.description ? (
                      <p className="text-muted-foreground text-sm">{question.description}</p>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    {renderField(question, value, error)}
                    {error && (
                      <p id={`${question.key}-error`} className="text-destructive mt-2 text-sm">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const reactKey = getQuestionReactKey(question, index)
        const value = responses[question.key]
        const error = errors[question.key]

        if (renderMode === "fieldsOnly") {
          return (
            <div key={reactKey} className="space-y-2">
              {renderField(question, value, error)}
              {error && (
                <p id={`${question.key}-error`} className="text-destructive mt-2 text-sm">
                  {error}
                </p>
              )}
            </div>
          )
        }

        return (
          <Card key={reactKey} className="border-0 bg-transparent p-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">{question.label}</CardTitle>
                    {question.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  {question.description && <CardDescription>{question.description}</CardDescription>}
                </div>
                {question.category && (
                  <Badge variant="secondary" className="text-xs">
                    {question.category}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderField(question, value, error)}
              {error && (
                <p id={`${question.key}-error`} className="text-destructive mt-2 text-sm">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
