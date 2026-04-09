import "dotenv/config"
import { adminSupabase } from "../lib/supabase/admin"
import { resetRoleQuestionScope, type ResetScopeEntryKindConfig } from "../lib/dev/reset-role-question-scope"

const DEFAULT_DEPARTMENT_ID = "beb111c3-b4e4-44af-b76d-f36935e40272"
const DEFAULT_ROLE_KEY = "sales-promoter"

function parseArgs(argv: string[]) {
  const args = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) continue
    const key = token.slice(2)
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : "true"
    args.set(key, value)
  }

  return args
}

function buildEntryKinds(entryKindsArg: string, supportsAssignedArg: string): ResetScopeEntryKindConfig[] {
  const entryKinds = entryKindsArg
    .split(",")
    .map((entryKind) => entryKind.trim())
    .filter(Boolean)
  const supportsAssigned = new Set(
    supportsAssignedArg
      .split(",")
      .map((entryKind) => entryKind.trim())
      .filter(Boolean)
  )

  return entryKinds.map((entryKind, index) => ({
    entry_kind: entryKind,
    label: entryKind
      .split(/[_-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    description: null,
    sort_order: index,
    is_default: index === 0,
    is_active: true,
    supports_assigned_agent: supportsAssigned.has(entryKind),
    color: null,
    icon: null,
  }))
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("This reset script is development-only. Run it with NODE_ENV=development.")
  }

  const args = parseArgs(process.argv.slice(2))
  const departmentId = args.get("department-id") || DEFAULT_DEPARTMENT_ID
  const roleKey = args.get("role-key") || DEFAULT_ROLE_KEY
  const entryKindsArg = args.get("entry-kinds") || "standard,majoractivities"
  const supportsAssignedArg = args.get("supports-assigned") || ""

  const result = await resetRoleQuestionScope(adminSupabase, {
    departmentId,
    departmentRoleKey: roleKey,
    entryKinds: buildEntryKinds(entryKindsArg, supportsAssignedArg),
  })

  console.log("Reset complete:")
  console.log(JSON.stringify({ departmentId, roleKey, entryKindsArg, supportsAssignedArg, result }, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
