#!/usr/bin/env node

/**
 * Script to pull existing roles and permissions from Supabase database
 * and generate TypeScript defaults for lib/rbac/types.ts
 */

const { createClient } = require("@supabase/supabase-js")
const fs = require("fs")
const path = require("path")

// Load environment variables
require("dotenv").config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials. Check your .env.local file.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function pullRolesAndPermissions() {
  console.log("🔗 Connecting to Supabase...")

  try {
    // Pull all roles
    console.log("📥 Pulling roles...")
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("*")
      .order("level", { ascending: true })

    if (rolesError) {
      console.error("❌ Error pulling roles:", rolesError)
      process.exit(1)
    }

    console.log(`✅ Found ${roles.length} roles`)

    // Pull all permissions
    console.log("📥 Pulling permissions...")
    const { data: permissions, error: permissionsError } = await supabase
      .from("permissions")
      .select("*")
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (permissionsError) {
      console.error("❌ Error pulling permissions:", permissionsError)
      process.exit(1)
    }

    console.log(`✅ Found ${permissions.length} permissions`)

    // Pull role-permission mappings
    console.log("📥 Pulling role-permission mappings...")
    const { data: rolePermissions, error: rolePermissionsError } = await supabase
      .from("permissions")
      .select("id, role_id, resource, action")

    if (rolePermissionsError) {
      console.error("❌ Error pulling role permissions:", rolePermissionsError)
      process.exit(1)
    }

    console.log(`✅ Found ${rolePermissions.length} role-permission mappings`)

    // Generate TypeScript code
    console.log("🔧 Generating TypeScript code...")

    const generatedCode = generateTypeScriptCode(roles, permissions, rolePermissions)

    // Write to file
    const outputPath = path.join(__dirname, "../lib/rbac/database-defaults.ts")
    fs.writeFileSync(outputPath, generatedCode)

    console.log(`✅ Generated database defaults at: ${outputPath}`)
    console.log("\n📋 Next steps:")
    console.log("1. Review the generated file")
    console.log("2. Update lib/rbac/types.ts to import and use DATABASE_DEFAULT_ROLES")
    console.log("3. Test the permission system")
  } catch (error) {
    console.error("❌ Unexpected error:", error)
    process.exit(1)
  }
}

function generateTypeScriptCode(roles, permissions, rolePermissions) {
  const timestamp = new Date().toISOString()

  // Create role permissions mapping
  const rolePermissionMap = {}
  rolePermissions.forEach((rp) => {
    if (!rolePermissionMap[rp.role_id]) {
      rolePermissionMap[rp.role_id] = []
    }
    rolePermissionMap[rp.role_id].push(`${rp.resource}.${rp.action}`)
  })

  // Generate roles
  const generatedRoles = roles
    .map((role) => {
      const rolePerms = rolePermissionMap[role.id] || []
      const permissionNames = rolePerms.filter(Boolean)

      return `  {
    id: "${role.id}",
    name: "${role.name}",
    displayName: "${role.name}",
    description: "${role.description || ""}",
    level: ${role.level},
    permissions: [
${permissionNames.map((p) => `      "${p}"`).join(",\n")}
    ],
    isSystem: false,
    createdAt: "${role.created_at || timestamp}",
    updatedAt: "${role.updated_at || timestamp}",
  }`
    })
    .join(",\n")

  // Generate unique permissions from rolePermissions
  const uniquePermissions = {}
  rolePermissions.forEach((rp) => {
    const key = `${rp.resource}.${rp.action}`
    if (!uniquePermissions[key]) {
      uniquePermissions[key] = {
        id: rp.id,
        name: key,
        resource: rp.resource,
        action: rp.action,
      }
    }
  })

  const generatedPermissions = Object.values(uniquePermissions)
    .map((perm) => {
      return `  {
    id: "${perm.id}",
    name: "${perm.name}",
    resource: "${perm.resource}",
    action: "${perm.action}",
    description: "${perm.resource} ${perm.action}",
    category: "read",
  }`
    })
    .join(",\n")

  return `/**
 * Database-driven roles and permissions
 * Generated on: ${timestamp}
 * 
 * This file contains roles and permissions pulled from the Supabase database.
 * Use these as defaults instead of the hardcoded values in lib/rbac/types.ts
 */

import { Role, Permission } from './types'

export const DATABASE_DEFAULT_ROLES: Role[] = [
${generatedRoles}
]

export const DATABASE_DEFAULT_PERMISSIONS: Permission[] = [
${generatedPermissions}
]

// Helper function to merge database defaults with fallback defaults
export function getRolesWithFallback(databaseRoles: Role[] = []): Role[] {
  if (databaseRoles.length > 0) {
    return databaseRoles
  }
  console.warn('⚠️  No roles found in database, falling back to database defaults')
  return DATABASE_DEFAULT_ROLES
}

export function getPermissionsWithFallback(databasePermissions: Permission[] = []): Permission[] {
  if (databasePermissions.length > 0) {
    return databasePermissions
  }
  console.warn('⚠️  No permissions found in database, falling back to database defaults')
  return DATABASE_DEFAULT_PERMISSIONS
}
`
}

// Run the script
pullRolesAndPermissions().catch(console.error)
