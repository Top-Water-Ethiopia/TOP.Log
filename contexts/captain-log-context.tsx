"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

export interface CaptainLogEntry {
  id: string
  date: string
  developmentTasks: string
  featuresCompleted: string
  challengesAndBlockers: string
  codeAndPriorities: string
  systemImprovements: string
  projectUpdates: string
  createdAt: string
  updatedAt: string
}

interface CaptainLogContextType {
  entries: CaptainLogEntry[]
  addEntry: (entry: Omit<CaptainLogEntry, "id" | "createdAt" | "updatedAt">) => void
  updateEntry: (id: string, entry: Partial<CaptainLogEntry>) => void
  deleteEntry: (id: string) => void
  getEntryByDate: (date: string) => CaptainLogEntry | undefined
}

const CaptainLogContext = createContext<CaptainLogContextType | undefined>(undefined)

export function CaptainLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CaptainLogEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("captain-log-entries")
    if (stored) {
      try {
        setEntries(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to load entries:", e)
      }
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage whenever entries change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("captain-log-entries", JSON.stringify(entries))
    }
  }, [entries, isLoaded])

  const addEntry = (entry: Omit<CaptainLogEntry, "id" | "createdAt" | "updatedAt">) => {
    const newEntry: CaptainLogEntry = {
      ...entry,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEntries([...entries, newEntry])
  }

  const updateEntry = (id: string, updates: Partial<CaptainLogEntry>) => {
    setEntries(
      entries.map((entry) => (entry.id === id ? { ...entry, ...updates, updatedAt: new Date().toISOString() } : entry)),
    )
  }

  const deleteEntry = (id: string) => {
    setEntries(entries.filter((entry) => entry.id !== id))
  }

  const getEntryByDate = (date: string) => {
    return entries.find((entry) => entry.date === date)
  }

  return (
    <CaptainLogContext.Provider value={{ entries, addEntry, updateEntry, deleteEntry, getEntryByDate }}>
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
