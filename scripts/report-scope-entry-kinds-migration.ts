/**
 * Phase 6 helper: report legacy profession_personal rows that have not been mapped to profession_role_id.
 *
 * Usage:
 *   NODE_ENV=development ts-node scripts/report-scope-entry-kinds-migration.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function main() {
  const { data: rows, error } = await supabase
    .from("scope_entry_kinds")
    .select("id, department_id, entry_kind, scope_type, department_profession_id, profession_role_id, label, is_active")
    .eq("scope_type", "profession_personal")
    .not("department_profession_id", "is", null)
    .is("profession_role_id", null)

  if (error) throw error

  const legacy = (rows || []) as Array<{
    id: string
    department_id: string
    entry_kind: string
    scope_type: string
    department_profession_id: string
    profession_role_id: string | null
    label: string
    is_active: boolean
  }>

  const candidates = legacy.filter((r) => looksLikeUuid(r.department_profession_id))
  const professionIds = Array.from(new Set(candidates.map((r) => r.department_profession_id)))

  const { data: roles, error: rolesError } =
    professionIds.length > 0
      ? await supabase.from("roles").select("id, name, type, scope, department_id").in("id", professionIds)
      : { data: [], error: null }

  if (rolesError) throw rolesError

  const roleIdSet = new Set((roles || []).map((r: any) => String(r.id)))

  const unmappedUuidIds = professionIds.filter((id) => !roleIdSet.has(id))
  const nonUuid = legacy.filter((r) => !looksLikeUuid(r.department_profession_id))

  console.log("=== scope_entry_kinds migration report ===")
  console.log(`Total legacy profession_personal rows missing profession_role_id: ${legacy.length}`)
  console.log(`- legacy department_profession_id looks like UUID: ${professionIds.length}`)
  console.log(`- UUIDs that do NOT exist in roles.id: ${unmappedUuidIds.length}`)
  console.log(`- legacy department_profession_id NOT uuid-shaped: ${nonUuid.length}`)

  if (unmappedUuidIds.length > 0) {
    console.log("\nUnmapped UUID-like department_profession_id values (not found in roles.id):")
    unmappedUuidIds.slice(0, 50).forEach((id) => console.log(`- ${id}`))
    if (unmappedUuidIds.length > 50) console.log(`... (${unmappedUuidIds.length - 50} more)`)
  }

  if (nonUuid.length > 0) {
    console.log("\nNon-UUID legacy department_profession_id examples (requires manual mapping or cleanup):")
    nonUuid.slice(0, 20).forEach((r) => console.log(`- ${r.department_profession_id} (dept=${r.department_id}, kind=${r.entry_kind})`))
    if (nonUuid.length > 20) console.log(`... (${nonUuid.length - 20} more)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

