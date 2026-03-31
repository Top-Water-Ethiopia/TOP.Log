import type { RoleQuestion } from "@/hooks/use-role-questions"

/**
 * Fetches initial role questions for the home page
 * Currently returns empty array as the home page loads questions dynamically
 */
export async function getInitialRoleQuestions(): Promise<RoleQuestion[]> {
  // The home page currently loads role questions dynamically based on user's department
  // We could preload common questions here for performance, but keeping it simple for now
  return []
}

/**
 * Alternative: Preload role questions for user's primary department
 * Uncomment if we want to optimize performance
 */
/*
export async function getInitialRoleQuestions(): Promise<RoleQuestion[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []
  
  // Get user's primary department
  const { data: deptRole } = await supabase
    .from("user_department_professions")
    .select("department_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()
    
  if (!deptRole) return []
  
  // Fetch role questions for that department
  const { data: questions } = await supabase
    .from("role_questions")
    .select("*")
    .eq("department_id", deptRole.department_id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    
  return (questions || []) as RoleQuestion[]
}
*/
