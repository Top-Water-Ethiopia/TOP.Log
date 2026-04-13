// Upload configuration constants to prevent backend-frontend drift

// Image constants
export const IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const

export const IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const IMAGE_MAX_FILES = 20

// File constants (documents, not images)
export const FILE_ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel", // XLS
  "application/rtf",
  "application/zip",
  "application/x-zip-compressed",
] as const

export const FILE_MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB
export const FILE_MAX_FILES = 5

// Extension fallback list for when MIME type is empty or unreliable
// Must stay synchronized with FILE_ACCEPTED_TYPES
export const FILE_ACCEPTED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "pptx",
  "txt",
  "csv",
  "xls",
  "xlsx",
  "rtf",
  "zip",
] as const

// Image extensions for consistency
export const IMAGE_ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"] as const

// File upload mode type - re-exported from upload-types for convenience
export type { FileUploadMode } from "@/lib/upload-types"
export { getFileUploadMode } from "@/lib/upload-types"
