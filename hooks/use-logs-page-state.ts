"use client"

import { useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  parseLogsPageState,
  type LogsPageState,
  type LogsPageSearchParams,
  buildLogsPageHrefFromState,
} from "@/lib/logs-page-filters"

export interface UseLogsPageStateResult {
  state: LogsPageState
  isCursorExpired: boolean
}

// Cursor TTL in milliseconds (5 minutes)
const CURSOR_TTL_MS = 5 * 60 * 1000

function isCursorExpired(cursorDate?: string): boolean {
  if (!cursorDate) return false
  try {
    const cursorTime = new Date(cursorDate).getTime()
    const now = Date.now()
    return now - cursorTime > CURSOR_TTL_MS
  } catch {
    return true
  }
}

export function useLogsPageState(): UseLogsPageStateResult {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Convert URLSearchParams to LogsPageSearchParams
  const params: LogsPageSearchParams = useMemo(() => {
    return {
      date: searchParams.get("date") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      month: searchParams.get("month") || undefined,
      page: searchParams.get("page") || undefined,
      nextCursorDate: searchParams.get("nextCursorDate") || undefined,
      nextCursorId: searchParams.get("nextCursorId") || undefined,
      selectedLogId: searchParams.get("selectedLogId") || undefined,
      searchName: searchParams.get("searchName") || undefined,
      view: searchParams.get("view") || undefined,
      professionRoleId: searchParams.get("professionRoleId") || undefined,
      entryKind: searchParams.get("entryKind") || undefined,
    }
  }, [searchParams])

  // Parse state with memoization on stable dependency
  const parsedState = useMemo(() => {
    return parseLogsPageState(params)
  }, [params])

  // Check cursor expiry
  const cursorExpired = useMemo(() => {
    return isCursorExpired(parsedState.nextCursorDate)
  }, [parsedState.nextCursorDate])

  // Canonicalize URL on mount (only if different)
  useEffect(() => {
    const currentHref = buildLogsPageHrefFromState(parsedState as Required<LogsPageState>)
    // Only replace if different to avoid redundant navigation
    if (
      typeof window !== "undefined" &&
      window.location.search !== new URL(currentHref, window.location.origin).search
    ) {
      router.replace(currentHref)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only on mount

  return {
    state: parsedState,
    isCursorExpired: cursorExpired,
  }
}
