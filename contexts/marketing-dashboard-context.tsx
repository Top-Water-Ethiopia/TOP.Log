"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { apiFetch } from "@/lib/api-client"

type DepartmentRow = {
  department_id: string
  department: {
    id?: string
    name: string
    description?: string | null
    is_active?: boolean
  }
}

type MarketingDashboardContextValue = {
  loading: boolean
  marketingDepartmentId: string | null
  marketingDepartmentName: string | null
}

const MarketingDashboardContext = createContext<MarketingDashboardContextValue | null>(null)

function isMarketingDepartmentName(name: string) {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return false
  return normalized === "marketing" || normalized.includes("marketing")
}

export function MarketingDashboardProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [marketingDepartmentId, setMarketingDepartmentId] = useState<string | null>(null)
  const [marketingDepartmentName, setMarketingDepartmentName] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const run = async () => {
      try {
        setLoading(true)
        const json = await apiFetch<{ data: DepartmentRow[] }>("/api/departments")
        const rows = Array.isArray(json.data) ? json.data : []
        const marketing = rows.find((row) => isMarketingDepartmentName(row.department?.name || ""))

        if (!isMounted) return
        setMarketingDepartmentId(marketing?.department_id || null)
        setMarketingDepartmentName(marketing?.department?.name || null)
      } catch {
        if (!isMounted) return
        setMarketingDepartmentId(null)
        setMarketingDepartmentName(null)
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    run()

    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo<MarketingDashboardContextValue>(
    () => ({ loading, marketingDepartmentId, marketingDepartmentName }),
    [loading, marketingDepartmentId, marketingDepartmentName]
  )

  return <MarketingDashboardContext.Provider value={value}>{children}</MarketingDashboardContext.Provider>
}

export function useMarketingDashboard() {
  const ctx = useContext(MarketingDashboardContext)
  if (!ctx) throw new Error("useMarketingDashboard must be used within MarketingDashboardProvider")
  return ctx
}
