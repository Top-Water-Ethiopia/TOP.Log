import { supabase } from "./supabase-client"
import { v4 as uuidv4 } from "uuid"
import { PostgrestError } from "@supabase/supabase-js"
import type { Database, Json } from "./supabase.types"

// Type definitions for entry operations
export type CaptainLogEntry = Database["public"]["Tables"]["captain_log_entries"]["Row"]
export type CaptainLogEntryInsert = Database["public"]["Tables"]["captain_log_entries"]["Insert"]
export type CaptainLogEntryUpdate = Database["public"]["Tables"]["captain_log_entries"]["Update"]

export type CustomResponse = Database["public"]["Tables"]["custom_responses"]["Row"]
export type CustomResponseInsert = Database["public"]["Tables"]["custom_responses"]["Insert"]

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"]
export type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"]

// Error handling
export class SupabaseDataError extends Error {
  code: string
  details: unknown

  constructor(message: string, code: string = "unknown", details?: unknown) {
    super(message)
    this.name = "SupabaseDataError"
    this.code = code
    this.details = details
  }
}

// Helper function to process Supabase errors
const handleSupabaseError = (error: PostgrestError): never => {
  // Enhanced logging with more context
  console.error("Supabase error:", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    fullError: error,
  })

  // Defensive check for undefined/null error
  if (!error) {
    throw new SupabaseDataError("Unknown error occurred while accessing the database", "unknown_error")
  }

  let errorCode = "unknown"
  if (error.code === "23505") {
    errorCode = "duplicate"
  } else if (error.code === "42P01") {
    errorCode = "table_not_found"
  } else if (error.code === "42703") {
    errorCode = "column_not_found"
  } else if (error.code === "22P02") {
    errorCode = "invalid_text_representation"
  } else if (error.code) {
    errorCode = error.code
  }

  throw new SupabaseDataError(
    error.message || "An error occurred while accessing the database",
    errorCode,
    error.details
  )
}

// Entry Operations
export async function getEntriesByUserId(userId: string) {
  const { data, error } = await supabase
    .from("captain_log_entries")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })

  if (error) handleSupabaseError(error)
  return data as CaptainLogEntry[]
}

export async function getProfessionRoleForUserInDepartment(userId: string, departmentId: string) {
  const { data, error } = await supabase
    .from("user_department_professions")
    .select("department_role_id")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) handleSupabaseError(error)

  const row = data as {
    department_role_id?: unknown
  } | null
  const roleId = typeof row?.department_role_id === "string" ? row.department_role_id : null

  if (!roleId) return null

  const { data: profession, error: professionError } = await (supabase as any)
    .from("department_professions")
    .select("id, label")
    .eq("id", roleId)
    .maybeSingle()

  if (professionError) handleSupabaseError(professionError)

  const typedProfession = profession as { label?: unknown } | null
  const roleName = typeof typedProfession?.label === "string" ? typedProfession.label : null
  return { roleId, roleName }
}

export async function getEntryById(id: string) {
  const { data, error } = await supabase.from("captain_log_entries").select("*").eq("id", id).single()

  if (error) {
    // Handle not found specifically
    if (error.code === "PGRST116") {
      return null
    }
    handleSupabaseError(error)
  }

  return data as CaptainLogEntry
}

export async function getEntryByDate(userId: string, date: string, departmentId?: string | null) {
  let query = supabase
    .from("captain_log_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1)

  if (departmentId === null) {
    query = query.is("department_id", null)
  } else if (typeof departmentId === "string") {
    query = query.eq("department_id", departmentId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    // Handle not found specifically
    if (error.code === "PGRST116") {
      return null
    }
    handleSupabaseError(error)
  }

  return data as CaptainLogEntry
}

export async function getEntriesByDateRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("captain_log_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })

  if (error) handleSupabaseError(error)
  return data as CaptainLogEntry[]
}

export async function createEntry(entry: CaptainLogEntryInsert) {
  // Set default values if not provided
  const entryWithDefaults: CaptainLogEntryInsert = {
    ...entry,
    id: entry.id || uuidv4(),
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || new Date().toISOString(),
    version: entry.version || 1,
  }

  console.log("[createEntry] inserting", {
    id: entryWithDefaults.id ?? null,
    user_id: entryWithDefaults.user_id ?? null,
    date: entryWithDefaults.date ?? null,
    department_id: entryWithDefaults.department_id ?? null,
  })

  const { data, error } = await supabase.from("captain_log_entries").insert(entryWithDefaults).select("*").single()

  if (error) {
    console.error("[createEntry] insert failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
  }

  if (error) handleSupabaseError(error)
  return data as CaptainLogEntry
}

export async function updateEntry(id: string, updates: CaptainLogEntryUpdate) {
  // Always update the timestamp and version
  const updatedEntry: CaptainLogEntryUpdate = {
    ...updates,
    updated_at: new Date().toISOString(),
    version: updates.version ? updates.version + 1 : undefined,
  }

  const { data, error } = await supabase
    .from("captain_log_entries")
    .update(updatedEntry)
    .eq("id", id)
    .select("*")
    .single()

  if (error) handleSupabaseError(error)
  return data as CaptainLogEntry
}

export async function deleteEntry(id: string) {
  // First delete associated custom responses (if any)
  await deleteCustomResponses(id)

  const { error } = await supabase.from("captain_log_entries").delete().eq("id", id)

  if (error) handleSupabaseError(error)
  return true
}

// Custom Responses Operations
export async function getCustomResponses(entryId: string) {
  const { data, error } = await supabase.from("custom_responses").select("*").eq("entry_id", entryId)

  if (error) handleSupabaseError(error)
  return data as CustomResponse[]
}

export async function getCustomResponsesForEntries(entryIds: string[]) {
  if (entryIds.length === 0) return []

  const { data, error } = await supabase.from("custom_responses").select("*").in("entry_id", entryIds)

  if (error) handleSupabaseError(error)
  return data as CustomResponse[]
}

export async function createCustomResponse(response: CustomResponseInsert) {
  const responseWithDefaults: CustomResponseInsert = {
    ...response,
    id: response.id || uuidv4(),
    timestamp: response.timestamp || new Date().toISOString(),
  }

  console.log("[createCustomResponse] inserting", {
    entry_id: responseWithDefaults.entry_id ?? null,
    question_id: responseWithDefaults.question_id ?? null,
    question_key: responseWithDefaults.question_key ?? null,
    question_category: responseWithDefaults.question_category ?? null,
  })

  const { data, error } = await supabase.from("custom_responses").insert(responseWithDefaults).select("*").single()

  if (error) {
    console.error("[createCustomResponse] insert failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
  }

  if (error) handleSupabaseError(error)
  return data as CustomResponse
}

export async function deleteCustomResponses(entryId: string) {
  const { error } = await supabase.from("custom_responses").delete().eq("entry_id", entryId)

  if (error) handleSupabaseError(error)
  return true
}

// Audit Log Operations
export async function createAuditLog(auditLog: AuditLogInsert) {
  const auditLogWithDefaults: AuditLogInsert = {
    ...auditLog,
    id: auditLog.id || uuidv4(),
    timestamp: auditLog.timestamp || new Date().toISOString(),
  }

  const { data, error } = await supabase.from("audit_logs").insert(auditLogWithDefaults).select("*").single()

  if (error) handleSupabaseError(error)
  return data as AuditLog
}

export async function getAuditLogs(userId: string, limit = 100) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(limit)

  if (error) handleSupabaseError(error)
  return data as AuditLog[]
}

// Search Operations
export async function searchEntries(userId: string, query: string) {
  // This is a simple implementation that searches across multiple text fields
  // For more complex searches, consider using Supabase's full-text search capabilities

  // We use ilike for case-insensitive matching with wildcards
  const searchPattern = `%${query}%`

  const { data, error } = await supabase
    .from("captain_log_entries")
    .select("*")
    .eq("user_id", userId)
    .or(
      `objectives.ilike.${searchPattern},key_results.ilike.${searchPattern},challenges.ilike.${searchPattern},development_tasks.ilike.${searchPattern},features_completed.ilike.${searchPattern},challenges_and_blockers.ilike.${searchPattern},code_and_priorities.ilike.${searchPattern},system_improvements.ilike.${searchPattern},project_updates.ilike.${searchPattern}`
    )
    .order("date", { ascending: false })

  if (error) handleSupabaseError(error)
  return data as CaptainLogEntry[]
}

// Data Migration
export async function migrateLocalStorageToSupabase(
  entries: unknown[],
  userId: string,
  progressCallback?: (current: number, total: number) => void
) {
  let successCount = 0
  let errorCount = 0
  const errors: Array<{ entry: unknown; error: unknown }> = []

  for (let i = 0; i < entries.length; i++) {
    try {
      const entry = entries[i] as Record<string, unknown>

      const migratedDepartmentId =
        entry && typeof entry === "object" && "department_id" in entry ? (entry.department_id as string | null) : null

      // Transform legacy format to new format (captain_log_entries table only stores core fields)
      const supabaseEntry: CaptainLogEntryInsert = {
        id: entry.id as string,
        user_id: userId,
        date: entry.date as string,
        department_id: migratedDepartmentId,
        created_at: (entry.createdAt as string) || new Date().toISOString(),
        updated_at: (entry.updatedAt as string) || new Date().toISOString(),
        version: (entry.version as number) || 1,
        metadata: (entry.metadata as Json) || null,
      }

      // Check if entry already exists (by date)
      const existingEntry = await getEntryByDate(userId, entry.date as string, migratedDepartmentId)

      if (existingEntry) {
        // Skip duplicate entries
        console.log(`Entry for date ${entry.date} already exists, skipping`)
        continue
      }

      // Create the entry
      const createdEntry = await createEntry(supabaseEntry)

      // Create custom responses for all the legacy fields
      const standardFields = [
        { key: "objectives", value: entry.objectives as string | undefined },
        { key: "keyResults", value: entry.keyResults as string | undefined },
        { key: "challenges", value: entry.challenges as string | undefined },
        { key: "developmentTasks", value: entry.developmentTasks as string | undefined },
        { key: "featuresCompleted", value: entry.featuresCompleted as string | undefined },
        { key: "challengesAndBlockers", value: entry.challengesAndBlockers as string | undefined },
        { key: "codeAndPriorities", value: entry.codeAndPriorities as string | undefined },
        { key: "systemImprovements", value: entry.systemImprovements as string | undefined },
        { key: "projectUpdates", value: entry.projectUpdates as string | undefined },
      ]

      for (const field of standardFields) {
        if (field.value) {
          await createCustomResponse({
            entry_id: createdEntry.id,
            question_id: `std_${field.key}`,
            question_key: field.key,
            question_label: field.key.charAt(0).toUpperCase() + field.key.slice(1),
            question_type: "textarea",
            question_category: "standard",
            value: field.value,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Handle custom responses if any
      const customResponses = entry.customResponses as Array<Record<string, unknown>> | undefined
      if (customResponses && Array.isArray(customResponses) && customResponses.length > 0) {
        for (const response of customResponses) {
          await createCustomResponse({
            entry_id: createdEntry.id,
            question_id: response.questionId as string,
            question_key: response.questionKey as string,
            question_label: response.questionLabel as string,
            question_type: (response.questionType as string) || null,
            question_category: (response.questionCategory as string) || null,
            value: response.value as Json,
            timestamp: (response.timestamp as string) || new Date().toISOString(),
          })
        }
      }

      successCount++
    } catch (error) {
      console.error(`Error migrating entry at index ${i}:`, error)
      errorCount++
      errors.push({ entry: entries[i], error })
    }

    // Report progress
    if (progressCallback) {
      progressCallback(i + 1, entries.length)
    }
  }

  return {
    total: entries.length,
    success: successCount,
    errors: errorCount,
    errorDetails: errors,
  }
}
