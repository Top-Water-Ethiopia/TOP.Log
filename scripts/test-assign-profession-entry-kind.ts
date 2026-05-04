import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function testAssignProfessionEntryKind() {
    console.log("🚀 Starting test: Assign Entry Kind to Profession...")

    try {
        // 1. Get a department
        const { data: departments, error: deptError } = await supabase
            .from("departments")
            .select("id, name")
            .limit(1)
        
        if (deptError || !departments || departments.length === 0) {
            console.error("❌ Failed to find a department:", deptError)
            return
        }
        
        const testDept = departments[0]
        console.log(`📍 Using department: ${testDept.name} (${testDept.id})`)

        // 2. Define a profession key consistently with what we've used in the app
        const professionKey = "sales-promoter"
        const customEntryKind = "test_profession_report_" + Date.now().toString().slice(-6)

        console.log(`✨ Creating custom entry kind "${customEntryKind}" for profession "${professionKey}"...`)

        // 3. Create a scope_entry_kind for this profession
        const { data: created, error: createError } = await supabase
            .from("scope_entry_kinds")
            .insert({
                department_id: testDept.id,
                department_profession_id: professionKey,
                entry_kind: customEntryKind,
                label: "Profession Test Report",
                description: "This should only be visible to " + professionKey,
                is_active: true,
                is_default: false,
                sort_order: 10,
                allow_multiple_per_day: true
            })
            .select()
            .single()

        if (createError) {
            console.error("❌ Failed to create scope_entry_kind:", createError)
            return
        }

        console.log("✅ Successfully created profession-scoped entry kind:", created.id)

        // 4. Verify we can fetch it back specifically
        const { data: fetched, error: fetchError } = await supabase
            .from("scope_entry_kinds")
            .select("*")
            .eq("department_id", testDept.id)
            .eq("department_profession_id", professionKey)
            .eq("entry_kind", customEntryKind)
            .single()

        if (fetchError || !fetched) {
            console.error("❌ Failed to fetch profession-scoped entry kind:", fetchError)
        } else {
            console.log("✅ Verified: Entry kind is correctly linked to profession:", fetched.department_profession_id)
            console.log("📦 Row data:", fetched)
        }

        // 5. Cleanup (optional, but good for tests)
        // await supabase.from("scope_entry_kinds").delete().eq("id", created.id)
        // console.log("🧹 Cleaned up test record.")

    } catch (error) {
        console.error("💥 Unexpected error:", error)
    }
}

testAssignProfessionEntryKind()
