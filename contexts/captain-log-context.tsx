"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { useAuth } from "./auth-context"
import { useSupabaseAuth } from "./supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import type { QuestionResponse } from "@/lib/rbac/types"
import { 
  canCreateEntryForDate, 
  canUpdateEntryForDate, 
  canDeleteEntry as validateDeleteEntry 
} from "@/lib/date-restrictions"

// ==================== ENTERPRISE SCHEMAS ====================

const EntryMetadataSchema = z.object({
  source: z.enum(["web", "api", "import"]).default("web"),
  tags: z.array(z.string()).default([]),
  userAgent: z.string().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  roleChangedAt: z.string().optional(),
  previousRole: z.string().optional(),
  statusChangedAt: z.string().optional(),
})

export const CaptainLogEntrySchema = z.object({
  id: z.string(),
  userId: z.string().optional(), // Optional for backward compatibility
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  // New simplified fields (v2.4.0)
  objectives: z.string().max(5000).default(""),
  keyResults: z.string().max(5000).default(""),
  challenges: z.string().max(5000).default(""),
  // Legacy fields (backward compatibility)
  developmentTasks: z.string().max(5000).default(""),
  featuresCompleted: z.string().max(5000).default(""),
  challengesAndBlockers: z.string().max(5000).default(""),
  codeAndPriorities: z.string().max(5000).default(""),
  systemImprovements: z.string().max(5000).default(""),
  projectUpdates: z.string().max(5000).default(""),
  // Custom question responses (v2.5.0)
  customResponses: z.array(z.object({
    questionId: z.string(),
    questionKey: z.string(),
    questionLabel: z.string().optional(),
    questionType: z.enum(["text", "textarea", "select", "multiselect", "checkbox", "number", "date"]).optional(),
    questionCategory: z.string().optional(),
    value: z.any(),
    timestamp: z.string(),
  })).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().positive().default(1),
  metadata: EntryMetadataSchema.default({}),
}).refine(
  (data) => {
    // Either new format (objectives + keyResults) OR old format (developmentTasks) OR custom responses must be filled
    const hasNewFormat = data.objectives && data.keyResults
    const hasLegacyFormat = data.developmentTasks
    const hasCustomResponses = data.customResponses && data.customResponses.length > 0
    
    return hasNewFormat || hasLegacyFormat || hasCustomResponses
  },
  {
    message: "Either objectives and key results, development tasks, or custom responses must be provided",
    path: ["objectives"],
  }
)

export type CaptainLogEntry = z.infer<typeof CaptainLogEntrySchema>

// ==================== AUDIT LOG ====================

export interface AuditLog {
  id: string
  timestamp: string
  operation: "CREATE" | "READ" | "UPDATE" | "DELETE"
  entityId: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

// ==================== ERROR HANDLING ====================

class CaptainLogError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: "LOW" | "MEDIUM" | "HIGH",
  ) {
    super(message)
    this.name = "CaptainLogError"
  }
}

// ==================== OBSERVABILITY ====================

class Logger {
  private sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  log(level: string, message: string, context?: Record<string, unknown>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
      ...context,
    }
    console.log(`[${level}]`, message, logEntry)
  }

  info(msg: string, ctx?: Record<string, unknown>) {
    this.log("INFO", msg, ctx)
  }
  warn(msg: string, ctx?: Record<string, unknown>) {
    this.log("WARN", msg, ctx)
  }
  error(msg: string, error?: unknown, ctx?: Record<string, unknown>) {
    this.log("ERROR", msg, { ...ctx, error: error instanceof Error ? error.message : String(error) })
  }
  audit(operation: string, details: Record<string, unknown>) {
    this.log("AUDIT", operation, details)
  }
}

const logger = new Logger()

// ==================== METRICS ====================

class Metrics {
  increment(name: string, value = 1, tags?: Record<string, unknown>) {
    logger.log("METRIC", `${name}: +${value}`, tags)
  }

  timing(name: string, duration: number, tags?: Record<string, unknown>) {
    logger.log("METRIC", `${name}: ${duration}ms`, tags)
  }
}

const metrics = new Metrics()

// ==================== CONTEXT TYPE ====================

interface CaptainLogContextType {
  entries: CaptainLogEntry[]
  isLoading: boolean
  error: Error | null
  auditLogs: AuditLog[]

  // Enhanced CRUD operations
  addEntry: (entry: Omit<CaptainLogEntry, "id" | "createdAt" | "updatedAt" | "version" | "metadata">) => Promise<void>
  updateEntry: (id: string, entry: Partial<CaptainLogEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getEntryByDate: (date: string) => CaptainLogEntry | undefined
  getEntryById: (id: string) => CaptainLogEntry | undefined

  // Batch operations
  batchDelete: (ids: string[]) => Promise<void>

  // Query operations
  searchEntries: (query: string) => CaptainLogEntry[]
  getEntriesByDateRange: (from: string, to: string) => CaptainLogEntry[]

  // Utility
  exportData: () => string
  importData: (data: string) => Promise<void>
  clearError: () => void
}

const CaptainLogContext = createContext<CaptainLogContextType | undefined>(undefined)

export function CaptainLogProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const { user: supabaseUser } = useSupabaseAuth() // Supabase authentication
  const { canPerformAction } = useRBAC()
  
  const [entries, setEntries] = useState<CaptainLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Combined authentication check - support both localStorage and Supabase auth
  const isUserAuthenticated = (isAuthenticated && user) || supabaseUser
  const currentUser = (user || supabaseUser) as typeof user // Type assertion since we check isUserAuthenticated before use

  const STORAGE_KEY = "captain-log-entries-v2"
  const BACKUP_KEY = "captain-log-backup"
  const AUDIT_KEY = "captain-log-audit"

  // ==================== STORAGE OPERATIONS ====================

  const saveToStorage = useCallback((data: CaptainLogEntry[]) => {
    const timer = performance.now()
    try {
      // Create backup before saving
      const current = localStorage.getItem(STORAGE_KEY)
      if (current) {
        localStorage.setItem(BACKUP_KEY, current)
      }

      // Validate before saving
      const validated = data.map((entry) => CaptainLogEntrySchema.parse(entry))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated))

      const duration = performance.now() - timer
      metrics.timing("storage.save", duration, { entries: data.length })
      logger.info("Data persisted to storage", { entries: data.length, duration })
    } catch (err) {
      logger.error("Storage save failed", err)
      toast.error("Failed to save data locally")
      throw err
    }
  }, [])

  const loadFromStorage = useCallback((): CaptainLogEntry[] => {
    const timer = performance.now()
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []

      const parsed = JSON.parse(stored)
      const validated = Array.isArray(parsed) ? parsed.map((e) => CaptainLogEntrySchema.parse(e)) : []
      const normalized = validated.map((entry) => ({
        ...entry,
        customResponses: (entry.customResponses || []).map((response) => ({
          ...response,
          questionLabel: response.questionLabel || response.questionKey,
          questionType: response.questionType || "text",
        })),
      }))

      const duration = performance.now() - timer
      metrics.timing("storage.load", duration, { entries: validated.length })
      logger.info("Data loaded from storage", { entries: normalized.length, duration })

      return normalized
    } catch (err) {
      logger.error("Storage load failed, attempting backup restore", err)

      // Attempt backup restore
      try {
        const backup = localStorage.getItem(BACKUP_KEY)
        if (backup) {
          const parsed = JSON.parse(backup)
          toast.success("Restored from backup")
          return Array.isArray(parsed) ? parsed : []
        }
      } catch (backupErr) {
        logger.error("Backup restore failed", backupErr)
      }

      toast.error("Failed to load data")
      return []
    }
  }, [])

  // Load from localStorage on mount
  useEffect(() => {
    const timer = performance.now()
    setIsLoading(true)

    try {
      const loaded = loadFromStorage()
      setEntries(loaded)

      // Load audit logs
      const auditStored = localStorage.getItem(AUDIT_KEY)
      if (auditStored) {
        setAuditLogs(JSON.parse(auditStored))
      }

      const duration = performance.now() - timer
      logger.info("Repository initialized", { entries: loaded.length, duration })
      metrics.increment("repository.init.success")
    } catch (err) {
      logger.error("Repository initialization failed", err)
      setError(err as Error)
      metrics.increment("repository.init.failure")
    } finally {
      setIsLoaded(true)
      setIsLoading(false)
    }
  }, [])

  // Save to localStorage whenever entries change
  useEffect(() => {
    if (isLoaded) {
      saveToStorage(entries)
    }
  }, [entries, isLoaded, saveToStorage])

  // Save audit logs
  useEffect(() => {
    if (isLoaded && auditLogs.length > 0) {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs.slice(-1000))) // Keep last 1000
    }
  }, [auditLogs, isLoaded])

  // ==================== AUDIT LOGGING ====================

  const createAuditLog = useCallback(
    (operation: AuditLog["operation"], entityId: string, changes?: Record<string, unknown>) => {
      const audit: AuditLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        operation,
        entityId,
        changes,
        metadata: { userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined },
      }

      setAuditLogs((prev) => [...prev, audit])
      logger.audit(`${operation} operation`, { entityId, ...changes })
    },
    [],
  )

  // ==================== CRUD OPERATIONS ====================

  const addEntry = useCallback(
    async (entry: Omit<CaptainLogEntry, "id" | "createdAt" | "updatedAt" | "version" | "metadata">) => {
      // Check authentication and permissions - support both auth systems
      if (!isUserAuthenticated || !currentUser) {
        throw new CaptainLogError("Authentication required", "AUTH_ERROR", "HIGH")
      }

      if (!canPerformAction({ resource: "entries", action: "create" })) {
        throw new CaptainLogError("Insufficient permissions to create entries", "PERMISSION_ERROR", "HIGH")
      }

      const timer = performance.now()
      setIsLoading(true)
      setError(null)

      try {
        // Validation: Date restrictions (2-day window)
        const dateValidation = canCreateEntryForDate(entry.date)
        if (!dateValidation.isValid) {
          throw new CaptainLogError(dateValidation.error || "Invalid date", "VALIDATION_ERROR", "HIGH")
        }

        // Validation: Check for duplicates
        const existing = entries.find((e) => e.date === entry.date)
        if (existing) {
          throw new CaptainLogError(`Entry already exists for ${entry.date}`, "CONFLICT", "MEDIUM")
        }

        // Create entry with metadata and defaults
        const now = new Date().toISOString()
        const entryData = entry as any
        const newEntry = {
          // Spread entry data first
          ...entry,
          // Provide defaults for any missing fields (v2.4.0 new fields + legacy)
          objectives: entryData.objectives ?? "",
          keyResults: entryData.keyResults ?? "",
          challenges: entryData.challenges ?? "",
          developmentTasks: entryData.developmentTasks ?? "",
          featuresCompleted: entryData.featuresCompleted ?? "",
          challengesAndBlockers: entryData.challengesAndBlockers ?? "",
          codeAndPriorities: entryData.codeAndPriorities ?? "",
          systemImprovements: entryData.systemImprovements ?? "",
          projectUpdates: entryData.projectUpdates ?? "",
          customResponses: entryData.customResponses ?? [],
          // System fields
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: currentUser.id, // Add user ownership
          createdAt: now,
          updatedAt: now,
          version: 1,
          metadata: {
            source: "web",
            tags: [],
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            createdBy: currentUser.id,
          },
        }

        // Validate schema
        const validated = CaptainLogEntrySchema.parse(newEntry)

        // Optimistic update
        setEntries((prev) => [...prev, validated])

        // Audit log
        createAuditLog("CREATE", validated.id, { date: validated.date, userId: currentUser.id })

        const duration = performance.now() - timer
        metrics.timing("entry.create", duration)
        metrics.increment("entry.create.success")
        logger.info("Entry created", { id: validated.id, date: validated.date, userId: currentUser.id, duration })

        toast.success("Entry saved successfully")

        // Note: saveToStorage will be called by useEffect when entries state updates
      } catch (err) {
        metrics.increment("entry.create.failure")
        logger.error("Entry creation failed", err)
        setError(err as Error)

        const message = err instanceof CaptainLogError ? err.message : "Failed to create entry"
        toast.error(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [entries, createAuditLog, isUserAuthenticated, currentUser, canPerformAction],
  )

  const updateEntry = useCallback(
    async (id: string, updates: Partial<CaptainLogEntry>) => {
      // Check authentication and permissions - support both auth systems
      if (!isUserAuthenticated || !currentUser) {
        throw new CaptainLogError("Authentication required", "AUTH_ERROR", "HIGH")
      }

      const timer = performance.now()
      setIsLoading(true)
      setError(null)

      try {
        const existing = entries.find((e) => e.id === id)
        if (!existing) {
          throw new CaptainLogError(`Entry ${id} not found`, "NOT_FOUND", "LOW")
        }

        // Check ownership or admin permissions
        const canUpdate = canPerformAction(
          { resource: "entries", action: "update", ownResource: true },
          existing.userId
        )

        if (!canUpdate) {
          throw new CaptainLogError("Insufficient permissions to update this entry", "PERMISSION_ERROR", "HIGH")
        }

        // Validation: Date restrictions (2-day window)
        const dateToValidate = updates.date || existing.date
        const dateValidation = canUpdateEntryForDate(dateToValidate, existing.createdAt)
        if (!dateValidation.isValid) {
          throw new CaptainLogError(dateValidation.error || "Invalid date", "VALIDATION_ERROR", "HIGH")
        }

        // Create updated entry
        const updated: CaptainLogEntry = {
          ...existing,
          ...updates,
          id: existing.id, // Prevent ID change
          userId: existing.userId, // Prevent userId change
          createdAt: existing.createdAt, // Prevent createdAt change
          version: (existing.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          metadata: {
            ...existing.metadata,
            ...updates.metadata,
            updatedBy: currentUser.id,
          },
        }

        // Validate
        const validated = CaptainLogEntrySchema.parse(updated)

        // Optimistic update
        setEntries((prev) => prev.map((e) => (e.id === id ? validated : e)))

        // Audit log with changes
        const changes = Object.keys(updates).reduce(
          (acc, key) => {
            if (updates[key as keyof CaptainLogEntry] !== existing[key as keyof CaptainLogEntry]) {
              acc[key] = {
                from: existing[key as keyof CaptainLogEntry],
                to: updates[key as keyof CaptainLogEntry],
              }
            }
            return acc
          },
          {} as Record<string, unknown>,
        )
        createAuditLog("UPDATE", id, { ...changes, userId: currentUser.id })

        const duration = performance.now() - timer
        metrics.timing("entry.update", duration)
        metrics.increment("entry.update.success")
        logger.info("Entry updated", { id, version: validated.version, userId: currentUser.id, duration })

        toast.success("Entry updated successfully")

        // Note: saveToStorage will be called by useEffect when entries state updates
      } catch (err) {
        metrics.increment("entry.update.failure")
        logger.error("Entry update failed", err)
        setError(err as Error)

        const message = err instanceof CaptainLogError ? err.message : "Failed to update entry"
        toast.error(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [entries, createAuditLog, isUserAuthenticated, currentUser, canPerformAction],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      // Check authentication and permissions - support both auth systems
      if (!isUserAuthenticated || !currentUser) {
        throw new CaptainLogError("Authentication required", "AUTH_ERROR", "HIGH")
      }

      const timer = performance.now()
      setIsLoading(true)
      setError(null)

      try {
        const existing = entries.find((e) => e.id === id)
        if (!existing) {
          throw new CaptainLogError(`Entry ${id} not found`, "NOT_FOUND", "LOW")
        }

        // Validation: Deletion is not allowed (data retention policy)
        const deleteValidation = validateDeleteEntry(existing.date)
        if (!deleteValidation.isValid) {
          throw new CaptainLogError(deleteValidation.error || "Cannot delete entry", "VALIDATION_ERROR", "HIGH")
        }

        // Check ownership or admin permissions
        const canDelete = canPerformAction(
          { resource: "entries", action: "delete", ownResource: true },
          existing.userId
        )

        if (!canDelete) {
          throw new CaptainLogError("Insufficient permissions to delete this entry", "PERMISSION_ERROR", "HIGH")
        }

        // Optimistic delete
        setEntries((prev) => prev.filter((e) => e.id !== id))

        // Audit log
        createAuditLog("DELETE", id, { date: existing.date, userId: currentUser.id })

        const duration = performance.now() - timer
        metrics.timing("entry.delete", duration)
        metrics.increment("entry.delete.success")
        logger.info("Entry deleted", { id, userId: currentUser.id, duration })

        toast.success("Entry deleted successfully")
      } catch (err) {
        metrics.increment("entry.delete.failure")
        logger.error("Entry deletion failed", err)
        setError(err as Error)

        const message = err instanceof CaptainLogError ? err.message : "Failed to delete entry"
        toast.error(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [entries, createAuditLog, isUserAuthenticated, currentUser, canPerformAction],
  )

  const getEntryByDate = useCallback(
    (date: string) => {
      const entry = entries.find((entry) => entry.date === date)
      if (entry) {
        createAuditLog("READ", entry.id, { date })
      }
      return entry
    },
    [entries, createAuditLog],
  )

  const getEntryById = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id)
      if (entry) {
        createAuditLog("READ", id)
      }
      return entry
    },
    [entries, createAuditLog],
  )

  // ==================== BATCH OPERATIONS ====================

  const batchDelete = useCallback(
    async (ids: string[]) => {
      const timer = performance.now()
      setIsLoading(true)

      try {
        setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))
        ids.forEach((id) => createAuditLog("DELETE", id))

        const duration = performance.now() - timer
        metrics.timing("entry.batchDelete", duration, { count: ids.length })
        logger.info("Batch delete completed", { count: ids.length, duration })
        toast.success(`Deleted ${ids.length} entries`)
      } catch (err) {
        logger.error("Batch delete failed", err)
        toast.error("Failed to delete entries")
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [createAuditLog],
  )

  // ==================== QUERY OPERATIONS ====================

  const searchEntries = useCallback(
    (query: string) => {
      const searchLower = query.toLowerCase()
      return entries.filter((e) =>
        Object.values(e).some((v) => typeof v === "string" && v.toLowerCase().includes(searchLower)),
      )
    },
    [entries],
  )

  const getEntriesByDateRange = useCallback(
    (from: string, to: string) => {
      return entries.filter((e) => e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date))
    },
    [entries],
  )

  // ==================== UTILITY ====================

  const exportData = useCallback(() => {
    // Check authentication and permissions - support both auth systems
    if (!isUserAuthenticated || !currentUser) {
      throw new CaptainLogError("Authentication required", "AUTH_ERROR", "HIGH")
    }

    if (!canPerformAction({ resource: "entries", action: "export" })) {
      throw new CaptainLogError("Insufficient permissions to export data", "PERMISSION_ERROR", "HIGH")
    }

    const data = {
      entries,
      auditLogs: auditLogs.slice(-100), // Last 100 audit logs
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.id,
      version: "2.0",
    }
    logger.info("Data exported", { entries: entries.length, userId: currentUser.id })
    return JSON.stringify(data, null, 2)
  }, [entries, auditLogs, isUserAuthenticated, currentUser, canPerformAction])

  const importData = useCallback(async (data: string) => {
    // Check authentication and permissions - support both auth systems
    if (!isUserAuthenticated || !currentUser) {
      throw new CaptainLogError("Authentication required", "AUTH_ERROR", "HIGH")
    }

    if (!canPerformAction({ resource: "entries", action: "import" })) {
      throw new CaptainLogError("Insufficient permissions to import data", "PERMISSION_ERROR", "HIGH")
    }

    try {
      const parsed = JSON.parse(data)
      const imported = Array.isArray(parsed.entries) ? parsed.entries : parsed
      const validated = imported.map((e: unknown) => CaptainLogEntrySchema.parse(e))

      setEntries(validated)
      logger.info("Data imported", { entries: validated.length, userId: currentUser.id })
      toast.success(`Imported ${validated.length} entries`)
    } catch (err) {
      logger.error("Import failed", err)
      toast.error("Failed to import data")
      throw err
    }
  }, [isUserAuthenticated, currentUser, canPerformAction])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <CaptainLogContext.Provider
      value={{
        entries,
        isLoading,
        error,
        auditLogs,
        addEntry,
        updateEntry,
        deleteEntry,
        getEntryByDate,
        getEntryById,
        batchDelete,
        searchEntries,
        getEntriesByDateRange,
        exportData,
        importData,
        clearError,
      }}
    >
      {children}
    </CaptainLogContext.Provider>
  )
}

export function useCaptainLog() {
  const context = useContext(CaptainLogContext)
  if (!context) {
    throw new Error("useCaptainLog must be used within CaptainLogProvider")
  }
  return context
}
