"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useSupabaseAuth } from "./supabase-auth-context";
import { v4 as uuidv4 } from 'uuid';
import * as supabaseData from "@/lib/supabase-data";
import type { CaptainLogEntry, AuditLog } from "@/lib/supabase-data";
import { normalizeReportKind } from "@/lib/reporting-model";

// Context type
interface CaptainLogContextType {
  entries: CaptainLogEntry[];
  isLoading: boolean;
  error: Error | null;
  auditLogs: AuditLog[];

  // Enhanced CRUD operations
  addEntry: (entry: Omit<CaptainLogEntry, "id" | "user_id" | "created_at" | "updated_at" | "version">) => Promise<void>;
  updateEntry: (id: string, entry: Partial<CaptainLogEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getEntryByDate: (date: string) => CaptainLogEntry | undefined;
  getEntryById: (id: string) => CaptainLogEntry | undefined;

  // Batch operations
  batchDelete: (ids: string[]) => Promise<void>;

  // Query operations
  searchEntries: (query: string) => Promise<CaptainLogEntry[]>;
  getEntriesByDateRange: (from: string, to: string) => Promise<CaptainLogEntry[]>;

  // Utility
  exportData: () => string;
  importData: (data: string) => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
  clearError: () => void;

  // Refresh data
  refreshEntries: () => Promise<void>;
}

// Create the context
const SupabaseLogContext = createContext<CaptainLogContextType | undefined>(undefined);

// Provider component
export function SupabaseLogProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useSupabaseAuth();
  
  // State
  const [entries, setEntries] = useState<CaptainLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Load entries from Supabase
  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await supabaseData.getEntriesByUserId(user.id);
      setEntries(data);
      setError(null);
    } catch (error) {
      console.error("Failed to load entries:", error);
      setError(error as Error);
      toast.error("Failed to load your entries");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    if (!user) {
      setAuditLogs([]);
      return;
    }

    try {
      const data = await supabaseData.getAuditLogs(user.id);
      setAuditLogs(data);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    }
  }, [user]);

  // Initialize data on mount or user change
  useEffect(() => {
    if (user) {
      loadEntries();
      loadAuditLogs();
      setIsInitialized(true);
    } else {
      setEntries([]);
      setAuditLogs([]);
      setIsInitialized(false);
      setIsLoading(false);
    }
  }, [user, loadEntries, loadAuditLogs]);

  // CRUD Operations
  
  // Add entry
  const addEntry = useCallback(async (entry: Omit<CaptainLogEntry, "id" | "user_id" | "created_at" | "updated_at" | "version">) => {
    if (!user) {
      throw new Error("Authentication required");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check for duplicate by date
      const existingEntry = await supabaseData.getEntryByDate(user.id, entry.date);
      if (existingEntry) {
        throw new Error(`Entry already exists for ${entry.date}`);
      }

      // Create the entry
      const now = new Date().toISOString();
      const newEntry = await supabaseData.createEntry({
        ...entry,
        report_kind: normalizeReportKind(entry.report_kind),
        id: uuidv4(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
        version: 1
      });

      // Create audit log
      await supabaseData.createAuditLog({
        operation: "CREATE",
        entity_id: newEntry.id,
        user_id: user.id,
        metadata: { date: newEntry.date }
      });

      // Update local state
      setEntries(prev => [...prev, newEntry]);
      
      toast.success("Entry saved successfully");
    } catch (error) {
      console.error("Failed to add entry:", error);
      setError(error as Error);
      
      const message = error instanceof Error ? error.message : "Failed to create entry";
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Update entry
  const updateEntry = useCallback(async (id: string, updates: Partial<CaptainLogEntry>) => {
    if (!user) {
      throw new Error("Authentication required");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find the existing entry
      const existingEntry = entries.find(e => e.id === id);
      if (!existingEntry) {
        throw new Error(`Entry ${id} not found`);
      }

      // Update the entry
      const updatedEntry = await supabaseData.updateEntry(id, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      // Create audit log
      await supabaseData.createAuditLog({
        operation: "UPDATE",
        entity_id: id,
        user_id: user.id,
        changes: {
          from: Object.keys(updates).reduce((acc, key) => {
            const typedKey = key as keyof CaptainLogEntry;
            acc[key] = existingEntry[typedKey];
            return acc;
          }, {} as Record<string, any>),
          to: updates
        }
      });

      // Update local state
      setEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
      
      toast.success("Entry updated successfully");
    } catch (error) {
      console.error("Failed to update entry:", error);
      setError(error as Error);
      
      const message = error instanceof Error ? error.message : "Failed to update entry";
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [entries, user]);

  // Delete entry
  const deleteEntry = useCallback(async (id: string) => {
    if (!user) {
      throw new Error("Authentication required");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find the existing entry
      const existingEntry = entries.find(e => e.id === id);
      if (!existingEntry) {
        throw new Error(`Entry ${id} not found`);
      }

      // Delete the entry
      await supabaseData.deleteEntry(id);

      // Create audit log
      await supabaseData.createAuditLog({
        operation: "DELETE",
        entity_id: id,
        user_id: user.id,
        metadata: { date: existingEntry.date }
      });

      // Update local state
      setEntries(prev => prev.filter(e => e.id !== id));
      
      toast.success("Entry deleted successfully");
    } catch (error) {
      console.error("Failed to delete entry:", error);
      setError(error as Error);
      
      const message = error instanceof Error ? error.message : "Failed to delete entry";
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [entries, user]);

  // Get entry by date
  const getEntryByDate = useCallback((date: string) => {
    return entries.find(entry => entry.date === date);
  }, [entries]);

  // Get entry by id
  const getEntryById = useCallback((id: string) => {
    return entries.find(entry => entry.id === id);
  }, [entries]);

  // Batch Operations

  // Batch delete
  const batchDelete = useCallback(async (ids: string[]) => {
    if (!user) {
      throw new Error("Authentication required");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Delete entries one by one
      for (const id of ids) {
        await supabaseData.deleteEntry(id);
        
        // Create audit log for each deletion
        await supabaseData.createAuditLog({
          operation: "DELETE",
          entity_id: id,
          user_id: user.id
        });
      }

      // Update local state
      setEntries(prev => prev.filter(e => !ids.includes(e.id)));
      
      toast.success(`Deleted ${ids.length} entries`);
    } catch (error) {
      console.error("Failed to batch delete entries:", error);
      setError(error as Error);
      
      const message = error instanceof Error ? error.message : "Failed to delete entries";
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Query Operations

  // Search entries
  const searchEntries = useCallback(async (query: string) => {
    if (!user) {
      return [];
    }

    try {
      return await supabaseData.searchEntries(user.id, query);
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Search failed");
      return [];
    }
  }, [user]);

  // Get entries by date range
  const getEntriesByDateRange = useCallback(async (from: string, to: string) => {
    if (!user) {
      return [];
    }

    try {
      return await supabaseData.getEntriesByDateRange(user.id, from, to);
    } catch (error) {
      console.error("Failed to get entries by date range:", error);
      toast.error("Failed to fetch entries");
      return [];
    }
  }, [user]);

  // Utility Functions

  // Export data
  const exportData = useCallback(() => {
    if (!user) {
      throw new Error("Authentication required");
    }

    const data = {
      entries,
      auditLogs: auditLogs.slice(-100), // Last 100 audit logs
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
      version: "2.0",
    };
    
    return JSON.stringify(data, null, 2);
  }, [entries, auditLogs, user]);

  // Import data
  const importData = useCallback(async (data: string) => {
    if (!user) {
      throw new Error("Authentication required");
    }

    setIsLoading(true);
    setError(null);

    try {
      const parsedData = JSON.parse(data);
      const importedEntries = Array.isArray(parsedData.entries) ? parsedData.entries : parsedData;
      
      if (!Array.isArray(importedEntries)) {
        throw new Error("Invalid import data format");
      }

      // Import entries one by one
      for (const entry of importedEntries) {
        // Check if entry already exists by date
        const existingEntry = await supabaseData.getEntryByDate(user.id, entry.date);
        
        if (existingEntry) {
          console.log(`Entry for ${entry.date} already exists, skipping`);
          continue;
        }

        // Create new entry
        await supabaseData.createEntry({
          ...entry,
          id: uuidv4(), // Generate new ID to avoid conflicts
          user_id: user.id,
          created_at: entry.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1
        });
      }

      // Create audit log
      await supabaseData.createAuditLog({
        operation: "IMPORT",
        entity_id: "batch",
        user_id: user.id,
        metadata: { count: importedEntries.length }
      });

      // Refresh entries
      await loadEntries();
      
      toast.success(`Imported ${importedEntries.length} entries`);
    } catch (error) {
      console.error("Import failed:", error);
      setError(error as Error);
      
      const message = error instanceof Error ? error.message : "Failed to import data";
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadEntries]);

  // Migrate from localStorage
  const migrateFromLocalStorage = useCallback(async () => {
    if (!user) {
      throw new Error("Authentication required");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load entries from localStorage
      const STORAGE_KEY = "captain-log-entries-v2";
      const stored = localStorage.getItem(STORAGE_KEY);
      
      if (!stored) {
        toast.info("No local entries found to migrate");
        return;
      }

      const localEntries = JSON.parse(stored);
      
      if (!Array.isArray(localEntries) || localEntries.length === 0) {
        toast.info("No local entries found to migrate");
        return;
      }

      // Show migration toast
      toast.loading(`Migrating ${localEntries.length} entries to Supabase...`, { duration: 0, id: "migration" });

      // Migrate entries
      const result = await supabaseData.migrateLocalStorageToSupabase(
        localEntries,
        user.id,
        (current, total) => {
          toast.loading(`Migrating entries: ${current}/${total}`, { duration: 0, id: "migration" });
        }
      );

      // Create audit log
      await supabaseData.createAuditLog({
        operation: "MIGRATION",
        entity_id: "batch",
        user_id: user.id,
        metadata: { 
          total: result.total,
          success: result.success,
          errors: result.errors
        }
      });

      // Refresh entries
      await loadEntries();
      
      toast.dismiss("migration");
      
      if (result.errors === 0) {
        toast.success(`Successfully migrated ${result.success} entries`);
      } else {
        toast.warning(`Migrated ${result.success} entries, ${result.errors} failed`);
      }

      // Optional: rename the old localStorage key to avoid re-migration
      localStorage.setItem("captain-log-entries-v2-migrated", stored);
      localStorage.removeItem(STORAGE_KEY);
      
    } catch (error) {
      console.error("Migration failed:", error);
      setError(error as Error);
      
      toast.dismiss("migration");
      const message = error instanceof Error ? error.message : "Failed to migrate data";
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadEntries]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh entries
  const refreshEntries = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      await loadEntries();
    } catch (error) {
      console.error("Failed to refresh entries:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, loadEntries]);

  // Context value
  const contextValue: CaptainLogContextType = {
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
    migrateFromLocalStorage,
    clearError,
    refreshEntries
  };

  return (
    <SupabaseLogContext.Provider value={contextValue}>
      {children}
    </SupabaseLogContext.Provider>
  );
}

// Custom hook
export function useSupabaseLog() {
  const context = useContext(SupabaseLogContext);
  
  if (context === undefined) {
    throw new Error("useSupabaseLog must be used within a SupabaseLogProvider");
  }
  
  return context;
}
