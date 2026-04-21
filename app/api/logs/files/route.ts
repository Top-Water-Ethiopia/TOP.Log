import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  compareLogAssetsNewestFirst,
  dedupeLogAssetsKeepingNewest,
  extractLogAssetsFromResponses,
  type LogAsset,
  type LogAssetSourceResponse,
  shouldIncludeAssetForUser,
} from "@/lib/log-assets"
import { FILES_BATCH_SIZE, FILES_MAX_ENTRY_SCAN, FILES_TARGET_ASSETS } from "@/lib/log-files-constants"
import { getEffectivePermissionsForUser } from "@/lib/rbac/server"

type Cursor = { createdAt: string; id: string }

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseCursor(searchParams: URLSearchParams): Cursor | null {
  const createdAt = searchParams.get("cursorCreatedAt")
  const id = searchParams.get("cursorId")
  if (!createdAt || !id) return null
  return { createdAt, id }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const departmentId = url.searchParams.get("departmentId") || null
  const cursor = parseCursor(url.searchParams)
  const batchSize = parsePositiveInt(url.searchParams.get("batchSize"), FILES_BATCH_SIZE)
  const targetAssets = parsePositiveInt(url.searchParams.get("targetAssets"), FILES_TARGET_ASSETS)
  const maxEntriesScanned = parsePositiveInt(url.searchParams.get("maxEntriesScanned"), FILES_MAX_ENTRY_SCAN)

  const { departmentAccess } = await getEffectivePermissionsForUser(user.id)
  const leadDepartmentIds = new Set(
    departmentAccess
      .filter((da) => da.permissions.includes("entries.read_any"))
      .map((da) => da.departmentId)
  )

  const collected: LogAsset[] = []
  let scanned = 0
  let nextCursor: Cursor | null = cursor
  let lastBatchSize = 0

  while (collected.length < targetAssets && scanned < maxEntriesScanned) {
    let entriesQuery = supabase
      .from("captain_log_entries")
      .select("id, created_at, date, user_id, subject_department_id")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(cursor ? batchSize * 2 : batchSize)

    if (departmentId) {
      entriesQuery = entriesQuery.eq("subject_department_id", departmentId)
    }

    if (nextCursor) {
      entriesQuery = entriesQuery.lte("created_at", nextCursor.createdAt)
    }

    const { data: entries, error: entriesError } = await entriesQuery
    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    const candidateRows =
      (entries || []).filter(
        (e): e is { id: string; created_at: string; date: string; user_id: string; subject_department_id: string | null } =>
          typeof e?.id === "string" &&
          typeof e?.date === "string" &&
          typeof e?.created_at === "string" &&
          typeof e?.user_id === "string"
      ) || []

    const currentCursor = nextCursor
    const cursorFiltered = currentCursor
      ? candidateRows.filter((row) => {
          const createdAt = row.created_at
          if (createdAt < currentCursor.createdAt) return true
          if (createdAt > currentCursor.createdAt) return false
          return row.id < currentCursor.id
        })
      : candidateRows

    const rows = cursorFiltered.slice(0, batchSize)

    lastBatchSize = rows.length
    if (rows.length === 0) {
      nextCursor = null
      break
    }

    scanned += rows.length
    const entryIds = rows.map((r) => r.id)

    const { data: responses, error: responsesError } = await supabase
      .from("custom_responses")
      .select("entry_id, question_key, question_label, question_type, value")
      .in("entry_id", entryIds)
      .in("question_type", ["image", "file"])

    if (responsesError) {
      return NextResponse.json({ error: responsesError.message }, { status: 500 })
    }

    const responsesByEntry = new Map<string, LogAssetSourceResponse[]>()
    ;(responses || []).forEach((r) => {
      const entryId = typeof r.entry_id === "string" ? r.entry_id : ""
      if (!entryId) return
      const list = responsesByEntry.get(entryId) || []
      list.push({
        question_type: typeof r.question_type === "string" ? r.question_type : null,
        question_key: typeof r.question_key === "string" ? r.question_key : null,
        question_label: typeof r.question_label === "string" ? r.question_label : null,
        value: r.value,
      })
      responsesByEntry.set(entryId, list)
    })

    for (const entry of rows) {
      const entryResponses = responsesByEntry.get(entry.id) || []
      if (entryResponses.length === 0) continue
      const extracted = extractLogAssetsFromResponses(entryResponses, {
        entryId: entry.id,
        entryDate: entry.date,
        entryCreatedAt: entry.created_at,
        entryUserId: entry.user_id,
      })

      const canViewAll = entry.subject_department_id ? leadDepartmentIds.has(entry.subject_department_id) : false

      for (const asset of extracted) {
        if (!shouldIncludeAssetForUser(asset, { entryUserId: entry.user_id }, user.id, canViewAll)) continue
        collected.push(asset)
      }
    }

    const last = rows[rows.length - 1]
    if (last?.created_at && last.id) {
      nextCursor = { createdAt: last.created_at, id: last.id }
    } else {
      nextCursor = null
      break
    }
  }

  const deduped = dedupeLogAssetsKeepingNewest(collected).sort(compareLogAssetsNewestFirst)

  return NextResponse.json({
    data: {
      assets: deduped,
      scannedEntries: scanned,
      nextCursor: nextCursor && scanned > 0 ? nextCursor : null,
      hasMore: !!nextCursor && scanned > 0 && lastBatchSize > 0,
    },
  })
}
