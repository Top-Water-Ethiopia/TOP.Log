/**
 * Enterprise-grade validation schemas using Zod
 * Implements strict type-safe validation for all data operations
 */

import { z } from "zod"

/**
 * Base Captain Log Entry Schema
 * Comprehensive validation with business rules
 */
const BaseCaptainLogEntrySchema = z.object({
  id: z.string().uuid("Invalid entry ID format"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((date) => {
      const parsed = new Date(date)
      return !isNaN(parsed.getTime())
    }, "Invalid date"),
  
  // New simplified fields (v2.4.0)
  objectives: z.string().max(5000, "Objectives exceed maximum length").default(""),
  keyResults: z.string().max(5000, "Key results exceed maximum length").default(""),
  challenges: z.string().max(5000, "Challenges exceed maximum length").default(""),
  
  // Legacy fields (for backward compatibility)
  developmentTasks: z.string().max(5000, "Development tasks exceed maximum length").default(""),
  featuresCompleted: z.string().max(5000, "Features completed exceed maximum length").default(""),
  challengesAndBlockers: z.string().max(5000, "Challenges exceed maximum length").default(""),
  codeAndPriorities: z.string().max(5000, "Code and priorities exceed maximum length").default(""),
  systemImprovements: z.string().max(5000, "System improvements exceed maximum length").default(""),
  projectUpdates: z.string().max(5000, "Project updates exceed maximum length").default(""),
  
  createdAt: z.string().datetime("Invalid created timestamp"),
  updatedAt: z.string().datetime("Invalid updated timestamp"),
  version: z.number().int().positive().default(1),
  metadata: z
    .object({
      source: z.enum(["web", "api", "import"]).default("web"),
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      tags: z.array(z.string()).default([]),
    })
    .default({}),
})

/**
 * Full Captain Log Entry Schema with validation
 */
export const CaptainLogEntrySchema = BaseCaptainLogEntrySchema.refine(
  (data) => {
    // Either new format (objectives + keyResults) OR old format (developmentTasks) must be filled
    return (data.objectives && data.keyResults) || data.developmentTasks
  },
  {
    message: "Either objectives and key results, or development tasks must be provided",
    path: ["objectives"],
  }
)

/**
 * Create Entry DTO Schema
 * Used for entry creation validation
 */
export const CreateEntrySchema = BaseCaptainLogEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
}).refine(
  (data) => {
    // Either new format (objectives + keyResults) OR old format (developmentTasks) must be filled
    return (data.objectives && data.keyResults) || data.developmentTasks
  },
  {
    message: "Either objectives and key results, or development tasks must be provided",
    path: ["objectives"],
  }
)

/**
 * Update Entry DTO Schema
 * Partial updates with validation
 */
export const UpdateEntrySchema = BaseCaptainLogEntrySchema.omit({
  id: true,
  createdAt: true,
  version: true,
}).partial()

/**
 * Entry Query Parameters Schema
 */
export const EntryQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
  sortBy: z.enum(["date", "createdAt", "updatedAt"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Audit Log Schema
 * Tracks all data operations for compliance
 */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  operation: z.enum(["CREATE", "READ", "UPDATE", "DELETE"]),
  entityType: z.string(),
  entityId: z.string(),
  userId: z.string().optional(),
  changes: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

// Type exports
export type CaptainLogEntry = z.infer<typeof CaptainLogEntrySchema>
export type CreateEntryDTO = z.infer<typeof CreateEntrySchema>
export type UpdateEntryDTO = z.infer<typeof UpdateEntrySchema>
export type EntryQuery = z.infer<typeof EntryQuerySchema>
export type AuditLog = z.infer<typeof AuditLogSchema>

// Validation helper functions
export const validateEntry = (data: unknown) => CaptainLogEntrySchema.parse(data)
export const validateCreateEntry = (data: unknown) => CreateEntrySchema.parse(data)
export const validateUpdateEntry = (data: unknown) => UpdateEntrySchema.parse(data)
export const validateQuery = (data: unknown) => EntryQuerySchema.parse(data)
