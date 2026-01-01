import { supabase } from './supabase-client';
import { v4 as uuidv4 } from 'uuid';
import { PostgrestError } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

// Type definitions for entry operations
export type CaptainLogEntry = Database['public']['Tables']['captain_log_entries']['Row'];
export type CaptainLogEntryInsert = Database['public']['Tables']['captain_log_entries']['Insert'];
export type CaptainLogEntryUpdate = Database['public']['Tables']['captain_log_entries']['Update'];

export type CustomResponse = Database['public']['Tables']['custom_responses']['Row'];
export type CustomResponseInsert = Database['public']['Tables']['custom_responses']['Insert'];

export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

// Error handling
export class SupabaseDataError extends Error {
  code: string;
  details: any;
  
  constructor(message: string, code: string = 'unknown', details?: any) {
    super(message);
    this.name = 'SupabaseDataError';
    this.code = code;
    this.details = details;
  }
}

// Helper function to process Supabase errors
const handleSupabaseError = (error: PostgrestError): never => {
  // Enhanced logging with more context
  console.error('Supabase error:', {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    fullError: error
  });
  
  // Defensive check for undefined/null error
  if (!error) {
    throw new SupabaseDataError(
      'Unknown error occurred while accessing the database',
      'unknown_error'
    );
  }
  
  let errorCode = 'unknown';
  if (error.code === '23505') {
    errorCode = 'duplicate';
  } else if (error.code === '42P01') {
    errorCode = 'table_not_found';
  } else if (error.code === '42703') {
    errorCode = 'column_not_found';
  } else if (error.code === '22P02') {
    errorCode = 'invalid_text_representation';
  } else if (error.code) {
    errorCode = error.code;
  }
  
  throw new SupabaseDataError(
    error.message || 'An error occurred while accessing the database',
    errorCode,
    error.details
  );
};

// Entry Operations
export async function getEntriesByUserId(userId: string) {
  const { data, error } = await supabase
    .from('captain_log_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (error) handleSupabaseError(error);
  return data as CaptainLogEntry[];
}

export async function getEntryById(id: string) {
  const { data, error } = await supabase
    .from('captain_log_entries')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    // Handle not found specifically
    if (error.code === 'PGRST116') {
      return null;
    }
    handleSupabaseError(error);
  }
  
  return data as CaptainLogEntry;
}

export async function getEntryByDate(userId: string, date: string, departmentId?: string | null) {
  let query = supabase
    .from('captain_log_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1)

  if (departmentId === null) {
    query = query.is('department_id', null)
  } else if (typeof departmentId === 'string') {
    query = query.eq('department_id', departmentId)
  }

  const { data, error } = await query.maybeSingle();
  
  if (error) {
    // Handle not found specifically
    if (error.code === 'PGRST116') {
      return null;
    }
    handleSupabaseError(error);
  }
  
  return data as CaptainLogEntry;
}

export async function getEntriesByDateRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('captain_log_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });
  
  if (error) handleSupabaseError(error);
  return data as CaptainLogEntry[];
}

export async function createEntry(entry: CaptainLogEntryInsert) {
  // Set default values if not provided
  const entryWithDefaults: CaptainLogEntryInsert = {
    ...entry,
    id: entry.id || uuidv4(),
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || new Date().toISOString(),
    version: entry.version || 1,
  };
  
  const { data, error } = await supabase
    .from('captain_log_entries')
    .insert(entryWithDefaults)
    .select('*')
    .single();
  
  if (error) handleSupabaseError(error);
  return data as CaptainLogEntry;
}

export async function updateEntry(id: string, updates: CaptainLogEntryUpdate) {
  // Always update the timestamp and version
  const updatedEntry: CaptainLogEntryUpdate = {
    ...updates,
    updated_at: new Date().toISOString(),
    version: updates.version ? updates.version + 1 : undefined,
  };
  
  const { data, error } = await supabase
    .from('captain_log_entries')
    .update(updatedEntry)
    .eq('id', id)
    .select('*')
    .single();
  
  if (error) handleSupabaseError(error);
  return data as CaptainLogEntry;
}

export async function deleteEntry(id: string) {
  // First delete associated custom responses (if any)
  await deleteCustomResponses(id);
  
  const { error } = await supabase
    .from('captain_log_entries')
    .delete()
    .eq('id', id);
  
  if (error) handleSupabaseError(error);
  return true;
}

// Custom Responses Operations
export async function getCustomResponses(entryId: string) {
  const { data, error } = await supabase
    .from('custom_responses')
    .select('*')
    .eq('entry_id', entryId);
  
  if (error) handleSupabaseError(error);
  return data as CustomResponse[];
}

export async function createCustomResponse(response: CustomResponseInsert) {
  const responseWithDefaults: CustomResponseInsert = {
    ...response,
    id: response.id || uuidv4(),
    timestamp: response.timestamp || new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from('custom_responses')
    .insert(responseWithDefaults)
    .select('*')
    .single();
  
  if (error) handleSupabaseError(error);
  return data as CustomResponse;
}

export async function deleteCustomResponses(entryId: string) {
  const { error } = await supabase
    .from('custom_responses')
    .delete()
    .eq('entry_id', entryId);
  
  if (error) handleSupabaseError(error);
  return true;
}

// Audit Log Operations
export async function createAuditLog(auditLog: AuditLogInsert) {
  const auditLogWithDefaults: AuditLogInsert = {
    ...auditLog,
    id: auditLog.id || uuidv4(),
    timestamp: auditLog.timestamp || new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from('audit_logs')
    .insert(auditLogWithDefaults)
    .select('*')
    .single();
  
  if (error) handleSupabaseError(error);
  return data as AuditLog;
}

export async function getAuditLogs(userId: string, limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  
  if (error) handleSupabaseError(error);
  return data as AuditLog[];
}

// Search Operations
export async function searchEntries(userId: string, query: string) {
  // This is a simple implementation that searches across multiple text fields
  // For more complex searches, consider using Supabase's full-text search capabilities
  
  // We use ilike for case-insensitive matching with wildcards
  const searchPattern = `%${query}%`;
  
  const { data, error } = await supabase
    .from('captain_log_entries')
    .select('*')
    .eq('user_id', userId)
    .or(`objectives.ilike.${searchPattern},key_results.ilike.${searchPattern},challenges.ilike.${searchPattern},development_tasks.ilike.${searchPattern},features_completed.ilike.${searchPattern},challenges_and_blockers.ilike.${searchPattern},code_and_priorities.ilike.${searchPattern},system_improvements.ilike.${searchPattern},project_updates.ilike.${searchPattern}`)
    .order('date', { ascending: false });
  
  if (error) handleSupabaseError(error);
  return data as CaptainLogEntry[];
}

// Data Migration
export async function migrateLocalStorageToSupabase(
  entries: any[],
  userId: string,
  progressCallback?: (current: number, total: number) => void
) {
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{entry: any, error: any}> = [];
  
  for (let i = 0; i < entries.length; i++) {
    try {
      const entry = entries[i];

      const migratedDepartmentId =
        entry && typeof entry === 'object' && 'department_id' in entry ? ((entry as any).department_id as string | null) : null
      
      // Transform legacy format to new format (captain_log_entries table only stores core fields)
      const supabaseEntry: CaptainLogEntryInsert = {
        id: entry.id,
        user_id: userId,
        date: entry.date,
        department_id: migratedDepartmentId,
        created_at: entry.createdAt || new Date().toISOString(),
        updated_at: entry.updatedAt || new Date().toISOString(),
        version: entry.version || 1,
        metadata: entry.metadata || null,
      };
      
      // Check if entry already exists (by date)
      const existingEntry = await getEntryByDate(userId, entry.date, migratedDepartmentId);
      
      if (existingEntry) {
        // Skip duplicate entries
        console.log(`Entry for date ${entry.date} already exists, skipping`);
        continue;
      }
      
      // Create the entry
      const createdEntry = await createEntry(supabaseEntry);
      
      // Create custom responses for all the legacy fields
      const standardFields = [
        { key: 'objectives', value: entry.objectives },
        { key: 'keyResults', value: entry.keyResults },
        { key: 'challenges', value: entry.challenges },
        { key: 'developmentTasks', value: entry.developmentTasks },
        { key: 'featuresCompleted', value: entry.featuresCompleted },
        { key: 'challengesAndBlockers', value: entry.challengesAndBlockers },
        { key: 'codeAndPriorities', value: entry.codeAndPriorities },
        { key: 'systemImprovements', value: entry.systemImprovements },
        { key: 'projectUpdates', value: entry.projectUpdates }
      ];
      
      for (const field of standardFields) {
        if (field.value) {
          await createCustomResponse({
            entry_id: createdEntry.id,
            question_id: `std_${field.key}`,
            question_key: field.key,
            question_label: field.key.charAt(0).toUpperCase() + field.key.slice(1),
            question_type: 'textarea',
            question_category: 'standard',
            value: field.value,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Handle custom responses if any
      if (entry.customResponses && Array.isArray(entry.customResponses) && entry.customResponses.length > 0) {
        for (const response of entry.customResponses) {
          await createCustomResponse({
            entry_id: createdEntry.id,
            question_id: response.questionId,
            question_key: response.questionKey,
            question_label: response.questionLabel,
            question_type: response.questionType || null,
            question_category: response.questionCategory || null,
            value: response.value,
            timestamp: response.timestamp || new Date().toISOString(),
          });
        }
      }
      
      successCount++;
    } catch (error) {
      console.error(`Error migrating entry at index ${i}:`, error);
      errorCount++;
      errors.push({ entry: entries[i], error });
    }
    
    // Report progress
    if (progressCallback) {
      progressCallback(i + 1, entries.length);
    }
  }
  
  return {
    total: entries.length,
    success: successCount,
    errors: errorCount,
    errorDetails: errors,
  };
}
