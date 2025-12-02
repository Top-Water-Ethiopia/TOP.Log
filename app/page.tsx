import HomeUpdated from "./home-updated"
import { createClient } from "@/lib/supabase/server"

async function loadRoleQuestionsForUser() {
	const supabase = await createClient()

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return []
	}

	const { data: profile, error: profileError } = await supabase
		.from("user_profiles")
		.select("role_id")
		.eq("user_id", user.id)
		.single()

	if (profileError || !profile) {
		return []
	}

	const userProfile = profile as { role_id: string }

	const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
	const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
	const isSuperAdmin = userProfile.role_id === SUPER_ADMIN_ROLE_ID
	const isAdmin = userProfile.role_id === ADMIN_ROLE_ID || isSuperAdmin

	let query = supabase
		.from("role_questions")
		.select("*")
		.order("display_order", { ascending: true })
		.limit(10000)

	if (!isAdmin) {
		query = query
			.eq("is_active", true)
			.eq("role_id", userProfile.role_id)
	}

	const { data, error } = await query

	if (error || !data) {
		return []
	}

	return data
}

export default async function Home() {
	const initialRoleQuestions = await loadRoleQuestionsForUser()

	return <HomeUpdated initialRoleQuestions={initialRoleQuestions} />
}
